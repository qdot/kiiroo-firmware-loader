import Vue from "vue";
import { LaunchBluetooth } from "./bluetooth";
import { Component } from "vue-property-decorator";
const hex = require("nrf-intel-hex");

interface IFileReaderEventTarget extends EventTarget {
  result: string;
}

interface IFileReaderEvent extends Event {
  target: IFileReaderEventTarget;
  getMessage(): string;
}

// cheap trick to get us from [[a, b], [c], [d, e]] to [a, b, c, d, e]
function flatten(aValue: any) {
  return [].concat.apply([], aValue);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const firmwareFileTest = async (hexArrays: Map<number, Uint8Array>,
                                aFlashInfo: any): Promise<Map<number, number[][]>> => {
  // const aFlashInfo = { writeBlockCommandSize: 2,
  //                      flashEraseValue: 255,
  //                      programRowLength: 240,
  //                      bytesPerAddress: 3,
  //                      addressIncrementSize: 2,
  //                      programStartRow: 8,
  //                      addressesPerRow: 128 };

  // Map of row number to commands with data to fill the row with.
  const dataCommands: Map<number, number[][]> = new Map<number, number[][]>();

  // Figure out where the program starts
  const startingAddress = aFlashInfo.programStartRow * aFlashInfo.addressesPerRow * aFlashInfo.addressIncrementSize;
  const programAddressLength = aFlashInfo.programRowLength * aFlashInfo.addressesPerRow;

  const keyIter = hexArrays.keys();
  const eraseCommand: number[] = Array(3).fill(aFlashInfo.flashEraseValue);
  let keyValue = keyIter.next();
  // Figure out what the closest block is
  while (keyValue.value < startingAddress) {
    keyValue = keyIter.next();
  }

  while (!keyValue.done && keyValue.value < programAddressLength) {
    const currentBlock = Array.from(hexArrays.get(keyValue.value)!);
    const blockStartAddress = keyValue.value / 2;
    let currentRow = Math.floor(blockStartAddress / aFlashInfo.addressesPerRow);
    let commandArray: number[][] = [];
    // Since our block from the hex file may start after the row start, fill
    // with the erase value as needed until we hit the start point. Addresses
    // are multiplied by 2, so adjust accordingly.
    const fillAmount = (blockStartAddress % aFlashInfo.addressesPerRow) / 2;
    commandArray = commandArray.concat(Array(fillAmount).fill(eraseCommand));

    // Next, we'll turn our big block of binary into an array of 3 byte
    // commands. Due to the intel hex packer assuming 32-bit addresses (and the
    // pic24 architecture is crazy pants), every 4th byte is a zero, which we'll
    // need to remove, so we splice, then pop.
    while (currentBlock.length) {
      commandArray.push(currentBlock.splice(0, aFlashInfo.bytesPerAddress));
      if (currentBlock.shift() !== 0x00) {
        throw new Error("Trying to trim a non-zero value from hex data!");
      }
    }

    const commandLimit = (aFlashInfo.addressesPerRow / 2);

    // Magic number! We're limited by the size of the data GATT characteristic,
    // so we can only send over a certain number of commands per write. This
    // number is 6. Ends up being 19 bytes per line, 6 3-byte commands plus
    // the line counter.
    const commandsPerRowCommand = 6;
    while (commandArray.length > 0) {
      // The low nibble of the first byte of every data loading command is an
      // offset value. We increase it on every command array.
      let lineCounter: number = 0;
      // The high nibble of the first byte of every data loading command is
      // either 0x0 or 0x8. Toggle accordingly.
      //
      // (While this type isn't enforced well, still neat that I can try it.)
      let toggle: 0x0 | 0x80 = 0x0;
      let commandsRead = 0;
      let rowCommands: number[][] = [];
      // There is the possibility we've already written part of a row, then had
      // a hex file block change. If so, resume from the block change.
      if (dataCommands.has(currentRow)) {
        console.log("Already have row " + currentRow);
        rowCommands = dataCommands.get(currentRow)!;
        toggle = rowCommands[rowCommands.length - 1][0] & 0x80 ? 0x0 : 0x80;
      }
      while (commandsRead < commandLimit) {
        let dataCommand: number[] = [];
        if (commandsRead + commandsPerRowCommand < commandLimit) {
          if (commandArray.length < commandsPerRowCommand) {
            commandArray = commandArray.concat(Array(commandsPerRowCommand - commandArray.length).fill(eraseCommand));
          }
          dataCommand = flatten(commandArray.splice(0, commandsPerRowCommand));
          commandsRead += commandsPerRowCommand;
        } else {
          // If we've hit the row end, fill as much as we can then append null commands.
          dataCommand = flatten(commandArray.splice(0, commandLimit - commandsRead));
          // Paste some null commands on to the end to fill things out.
          dataCommand = dataCommand.concat(
            flatten(Array(commandsPerRowCommand - (commandLimit - commandsRead)).fill(eraseCommand)));
          commandsRead = commandLimit;
        }

        // If we have any value that doesn't equal the flash erase value, finish
        // adding the command to our output.
        if (dataCommand.some((x) => x !== aFlashInfo.flashEraseValue)) {
          // Attach the counter to the front of the line
          dataCommand.unshift(toggle | lineCounter);
          // Save it to our command array
          rowCommands.push(dataCommand);
          // Switch the toggle only if we're writing.
          toggle ^= 0x80;
        }
        // Always increment our line counter, as it serves as the write offset
        // into our current row.
        lineCounter += 1;
      }
      dataCommands.set(currentRow, rowCommands);
      currentRow += 1;
    }
    keyValue = keyIter.next();
  }
  return dataCommands;
};

@Component({})
export default class App extends Vue {
  private firmwareVersion: string | null = null;
  private firmwareCRC: string | null = null;
  private inAppMode: boolean | null = null;
  private isWorking: boolean = false;
  private logList: string[] = [];
  private firmware: Map<number, Uint8Array> | null = null;
  private firmwareLoadingProgress: string | null = null;
  private firmwareLoaded: boolean = false;
  private firmwareProgress: string | null = null;
  private firmwareLoading: boolean = false;

  public async ConnectAndDiagnose() {
    this.isWorking = true;
    this.logList = [];
    const device = new LaunchBluetooth();
    try {
      await device.Connect();
      this.inAppMode = await device.GetInAppMode();
      if (this.inAppMode) {
        await device.LockAppMode();
      }
      this.firmwareVersion = await device.GetVersion();
      const crc = await device.getMemoryCRC();
      this.firmwareCRC = crc[0].toString(16) + crc[1].toString(16);
      await device.Disconnect();
    } catch (e) {
      this.logList.push(e.toString());
      this.logList.push(e.stack);
    }

    this.isWorking = false;
  }

  public sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async ConnectAndTryModeChange() {
    this.isWorking = true;
    this.logList = [];
    const device = new LaunchBluetooth();
    try {
      await device.Connect();
      await device.rebootAndChangeMode();
      // This is so dumb, but if we don't bail on the wait, it just gets stuck.
      await this.sleep(1000);
      await device.Disconnect();
    } catch (e) {
      this.logList.push(e.toString());
      this.logList.push(e.stack);
    }
    this.isWorking = false;
  }

  public async ConnectAndTryModeLock() {
    this.isWorking = true;
    this.logList = [];
    const device = new LaunchBluetooth();
    try {
      await device.Connect();
      await device.LockAppMode();
      await device.Disconnect();
    } catch (e) {
      this.logList.push(e.toString());
      this.logList.push(e.stack);
    }
    this.isWorking = false;
  }

  public HasBluetooth() {
    return ((navigator !== undefined) &&
            (navigator.bluetooth !== undefined));
  }

  private LoadFirmwareFile(aFile: any): Promise<string> {
    const fr = new FileReader();
    let res: any;
    let rej: any;
    const p = new Promise<string>((aResolve, aReject) => {
      res = aResolve;
      rej = aReject;
    });
    fr.readAsText(aFile);
    fr.onload = function(e: IFileReaderEvent) {
      res(e.target.result);
    };
    return p;
  }

  private async onFirmwareFileChange(firmwareFile: FileList) {
    const firmware = await this.LoadFirmwareFile(firmwareFile[0]);
    let hexArrays: Map<number, Uint8Array>;
    try {
      hexArrays = hex.hexToArrays(firmware);
      this.firmware = hexArrays;
    } catch (e) {
      throw e;
    }
  }

  private async RebootToBootloader() {
    this.logList = [];
    console.log("Finding Launch");
    const d = new LaunchBluetooth();
    try {
      await d.Connect();
    } catch (e) {
      console.log(e);
      this.logList.push(e.toString());
      this.logList.push(e.stack);
      return;
    }
    console.log("Found Launch");
    if (await d.GetInAppMode()) {
      console.log("Rebooting Launch");
      await d.rebootAndChangeMode();
    }
  }

  private async LoadFirmware() {
    this.logList = [];
    this.firmwareProgress = "Connecting to the hardware...";
    const d = new LaunchBluetooth();
    try {
      await d.Connect();
      this.firmwareProgress = "Connected to the hardware...";
      this.firmwareLoading = true;
      if (await d.GetInAppMode()) {
        this.logList.push("We need to be in bootloader mode for this step. Please hit the back button below.");
        this.firmwareLoading = false;
        return;
      }
      this.firmwareProgress = "Getting flash info...";
      const flashInfo = await d.GetFlashInfo();
      const dataRows = await firmwareFileTest(this.firmware!, flashInfo);
      this.firmwareProgress = "Resetting hardware memory...";
      await d.eraseMemory();
      let i: number = 1;
      for (const row of Array.from(dataRows.keys())) {
        this.firmwareProgress = `Pushing Row ${i} of ${dataRows.size}...`;
        await d.pushRowData(dataRows.get(row)!);
        this.firmwareProgress = `Writing Row ${i} of ${dataRows.size}...`;
        await d.writeRowData(row);
        i += 1;
      }
      await d.verifyMemory();
      await d.getMemoryCRC();
      await d.rebootAndChangeMode();
      this.firmwareLoaded = true;
      this.firmwareProgress = `All done! The Launch should be blinking blue now. If it is, hit 'Continue'.`;
    } catch (e) {
      this.logList.push(e.toString());
      this.logList.push(e.stack);
      this.firmwareLoading = false;
      return;
    }
  }
}
