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
  private logList: string[] = [];

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

}
