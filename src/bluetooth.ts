import { EventEmitter } from "events";

export class LaunchBluetooth extends EventEmitter {
  private serviceUUID = "88f80580-0000-01e6-aace-0002a5d5c51b";
  private charUUIDs: any = { cmd: "88f80583-0000-01e6-aace-0002a5d5c51b",
                             // sensor: "88f80582-0000-01e6-aace-0002a5d5c51b",
                             data: "88f80581-0000-01e6-aace-0002a5d5c51b" };
  private _device: BluetoothDevice;
  private _server: BluetoothRemoteGATTServer;
  private _service: BluetoothRemoteGATTService;
  private _characteristics: Map<string, BluetoothRemoteGATTCharacteristic> =
    new Map<string, BluetoothRemoteGATTCharacteristic>();

  public Connect = async (): Promise<void> => {
    this._device = await navigator.bluetooth.requestDevice({
      filters: [{
        name: "Launch",
      }],
      optionalServices: [this.serviceUUID],
    });
    this._server = await this._device.gatt!.connect();
    this._service = await this._server.getPrimaryService(this.serviceUUID);
    this._device.addEventListener("gattserverdisconnected", this.OnDisconnect);
    for (const name of Object.getOwnPropertyNames(this.charUUIDs)) {
      this._characteristics.set(name, await this._service.getCharacteristic(this.charUUIDs[name]));
    }
  }

  public Disconnect = async () => {
    if (this._server.connected) {
      console.log("Disconnecting");
      await this._server.disconnect();
    }
  }

  public OnDisconnect = () => {
    this._device.removeEventListener("gattserverdisconnected", this.OnDisconnect);
    this.emit("deviceremoved");
  }

  public WriteValue = async (aCharacteristic: string,
                             aValue: Uint8Array,
                             aWaitForReturn: boolean = true): Promise<void> => {
    if (!this._characteristics.has(aCharacteristic)) {
      return;
    }
    const chr = this._characteristics.get(aCharacteristic)!;
    if (aWaitForReturn) {
      await chr.writeValue(aValue);
    } else {
      chr.writeValue(aValue);
    }
  }

  public ReadValue = async (aCharacteristic: string): Promise<Buffer> => {
    if (!this._characteristics.has(aCharacteristic)) {
      throw new Error("Tried to access wrong characteristic!");
    }
    const chr = this._characteristics.get(aCharacteristic)!;
    return Buffer.from((await chr.readValue()).buffer);
  }

  public async readCmd(): Promise<Buffer> {
    return this.ReadValue("cmd");
  }

  public async writeCmd(aData: Uint8Array, aWaitForReturn: boolean = true) {
    return this.WriteValue("cmd", aData, aWaitForReturn);
  }

  public async readData(): Promise<Buffer> {
    return this.ReadValue("data");
  }

  public async writeData(aData: Uint8Array, aWaitForReturn: boolean = true) {
    return this.WriteValue("data", aData, aWaitForReturn);
  }

  public async CommandWithResponse(aCommand: number, aData: number = 0x00): Promise<Buffer> {
    const cmd = Buffer.from([aCommand]);
    await this.writeCmd(cmd);
    await this.writeData(Buffer.from([aData]));
    let cmdRet = await this.readCmd();
    while (cmdRet[0] !== 0x2) {
      cmdRet = await this.readCmd();
      console.log(cmdRet[0]);
    }
    const dataRet = await this.readData();
    console.log(dataRet);
    return dataRet;
  }

  // Seems to be used after firmware loading to set machine back to app mode?
  public async LockAppMode() {
    await this.writeCmd(Buffer.from([0x0D]));
    await this.writeData(Buffer.from([0x4F, 0x4B]));
  }

  public async GetVersion(): Promise<string | null> {
    const data = await this.CommandWithResponse(0x05);
    if (data.length === 6) {
      return (data[4].toString() + "." + data[5].toString());
    }
    if (data.length === 12) {
      return (data[10].toString() + "." + data[11].toString());
    }
    return null;
  }

  public async GetInAppMode(): Promise<boolean> {
    return ((await this.CommandWithResponse(0x03))[1] & 0x1) > 0;
  }

  public async GetFlashInfo() {
    const flashInfo = await this.CommandWithResponse(0x0A);
    let i = 0;
    const is24BitAddressed: boolean = flashInfo.length === 9;
    const writeBlockCommandSize = is24BitAddressed ? 3 : 2;
    const flashEraseValue = is24BitAddressed ? flashInfo.readUInt8(i) : 0xFF;
    if (is24BitAddressed) {
      i += 1;
    }
    const addressIncrementSize = (flashInfo.readUInt8(i) & 0xF0) >> 4;
    const bytesPerAddress = flashInfo.readUInt8(i) & 0x0F;
    i += 1;
    const programRowLength = flashInfo.readUInt16BE(i);
    i += 2;
    const programStartRow = is24BitAddressed ?
      // Ugh no 24-bit reads in node's buffer class.
      flashInfo.readUInt8(i) | (flashInfo.readUInt16BE(i + 1) << 8) :
      flashInfo.readUInt16BE(i);
    i += is24BitAddressed ? 3 : 2;
    const addressesPerRow = flashInfo.readUInt16BE(i);
    return { writeBlockCommandSize,
             flashEraseValue,
             programRowLength,
             bytesPerAddress,
             addressIncrementSize,
             programStartRow,
             addressesPerRow };
  }

  public async Initialize() {
    await this.readCmd();
    await this.writeCmd(Buffer.from([0]));
  }

  public sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async pushRowData(dataArray: number[][]) {
    await this.writeCmd(Buffer.from([0x0b]));
    while (true) {
      for (const d of dataArray) {
        console.log("Pushing " + d);
        await this.writeData(Buffer.from(d));
        await this.sleep(40);
      }
      const ret = await this.readCmd();
      if (ret[0] !== 0x2) {
        console.log("Failed to push block: " + ret);
        await this.sleep(40);
        continue;
      }
      break;
    }
    await this.sleep(1000);
  }

  public async writeRowData(rowNumber: number) {
    await this.writeCmd(Buffer.from([0x0c]));
    await this.writeData(Buffer.from([0x0, rowNumber]));
    let ret = await this.readCmd();
    while (ret[0] !== 0x2) {
      ret = await this.readCmd();
      console.log(ret[0]);
    }
    if (ret[0] !== 0x2) {
      console.log("Failed to write block");
    }
    await this.sleep(1000);
  }

  public async verifyMemory() {
    await this.writeCmd(Buffer.from([0x08]));
    await this.writeData(Buffer.from([0x0]));
    let ret = await this.readCmd();
    while (ret[0] !== 0x2) {
      ret = await this.readCmd();
      console.log(ret[0]);
    }
    if (ret[0] !== 0x2) {
      console.log("Failed to verify memory");
    }
  }

  public async getMemoryCRC() {
    return this.CommandWithResponse(0x7);
  }

  public async rebootAndChangeMode() {
    await this.writeCmd(Buffer.from([0x06]));
    await this.writeData(Buffer.from([0x0]), false);
  }

  public async eraseMemory() {
    await this.writeCmd(Buffer.from([0x09]));
    await this.writeData(Buffer.from([0x0]));
    let ret = await this.readCmd();
    while (ret[0] !== 0x2) {
      ret = await this.readCmd();
      console.log(ret[0]);
    }
    if (ret[0] !== 0x2) {
      console.log("Failed to erase memory");
    }
  }
}
