import Vue from "vue";
import { LaunchBluetooth } from "./bluetooth";

import { Component } from "vue-property-decorator";

@Component({
})
export default class App extends Vue {
  private firmwareVersion: string | null = null;
  private firmwareCRC: string | null = null;
  private inAppMode: boolean | null = null;
  private isWorking: boolean = false;

  public async ConnectAndDiagnose() {
    this.isWorking = true;
    const device = new LaunchBluetooth();
    await device.Connect();
    this.inAppMode = await device.GetInAppMode();
    if (this.inAppMode) {
      await device.LockAppMode();
    }
    this.firmwareVersion = await device.GetVersion();
    const crc = await device.getMemoryCRC();
    this.firmwareCRC = crc[0].toString(16) + crc[1].toString(16);
    await device.Disconnect();
    this.isWorking = false;
  }

  public sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async ConnectAndTryModeChange() {
    this.isWorking = true;
    const device = new LaunchBluetooth();
    await device.Connect();
    try {
      await device.rebootAndChangeMode();
      // This is so dumb, but if we don't bail on the wait, it just gets stuck.
      await this.sleep(1000);
      await device.Disconnect();
    } catch (e) {
      console.log(e);
    }
    this.isWorking = false;
  }

  public async ConnectAndTryModeLock() {
    this.isWorking = true;
    const device = new LaunchBluetooth();
    await device.Connect();
    await device.LockAppMode();
    await device.Disconnect();
    this.isWorking = false;
  }
}
