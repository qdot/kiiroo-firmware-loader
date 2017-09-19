<template>
  <div id="app">
    <div>
    <md-stepper md-vertical>
      <md-step md-label="Welcome" :md-continue="HasBluetooth()">
        <p>Welcome to the Kiiroo Firmware Repair Utility. This is a community developed tool for loading and fixing firmware on Kiiroo toys.</p>

        <p v-if="HasBluetooth()">We currently only support the Fleshlight Launch. Pearl 2 support coming soon.</p>

        <p v-if="HasBluetooth()">Please note that this utility is neither developed nor endorsed by Kiiroo or Fleshlight. The developers of this tool are not liable for damage to products, and usage of this tool may void the warranty of your product.</p>

        <p v-if="!HasBluetooth()"><b>Unfortunately the browser you are currently using is not supported by this utility.</b> We require WebBluetooth, which is available on Google Chrome 61 for macOS and Linux, Chrome on Android 6 (M) or higher, and ChromeOS. This utility does not currently work on Windows or iOS.</p>
      </md-step>
      <md-step md-label="Initial Diagnosis" :md-continue="firmwareVersion !== null">
        <p>As a first step, we will need you to allow connection to your Fleshlight Launch so we can see what state it is in.</p>
        <p>Please click the Connect button below.</p>
        <md-button class="md-raised md-primary" @click="ConnectAndDiagnose">Connect</md-button>
        <br/>
        <div v-if="isWorking">
          <md-spinner md-indeterminate></md-spinner><br/>
          Retrieving information from hardware...<br/>
        </div>
        <div v-if="firmwareVersion !== null && !isWorking">
          <b>Firmware Version</b>: {{ this.firmwareVersion }}<br/>
          <b>Firmware CRC</b>: {{ this.firmwareCRC }}<br/>
          <b>Is the Launch in App Mode?</b>: {{ this.inAppMode ? "Yes" : "No"}}<br/>
        </div>
        <div v-if="logList.length > 0">
          <b>Errors:</b><br/>
          <p v-for="item in this.logList">
            {{ item }}
          </p>
        </div>
        <br/>
      </md-step>
      <md-step md-label="Mode Lock Test">
        <div v-if="!inAppMode">
          <p>It looks like your launch isn't in App Mode. This means you may just be stuck in bootloader mode after a successful firmware update.</p>
          <br/>
          <p>If you tried to update your firmware via FeelConnect, and the application got stuck on the "Finalizing" step then failed, read on. Otherwise, hit continue.</p>
          <br/>
          <md-button class="md-raised md-primary" id="mode-change-button" @click="ConnectAndTryModeChange">Connect and Try Mode Change</md-button>
          <br/>
          <md-button class="md-raised md-primary" id="mode-change-button" @click="ConnectAndTryModeLock">Connect and Try Mode Lock</md-button>
          <br/>
          <div v-if="isWorking">
            <md-spinner md-indeterminate></md-spinner><br/>
            Communicating with hardware, this may take a minute...<br/>
          </div>
        </div>
        <div v-if="inAppMode">
          <p>It looks like your Launch is in app mode, which means you probably want to update the firmware. Hit the continue button to proceed.</p>
        </div>
        <div v-if="logList.length > 0">
          <b>Errors:</b><br/>
          <p v-for="item in this.logList">
            {{ item }}
          </p>
        </div>
      </md-step>
      <md-step md-label="Select Firmware File" :md-continue="this.firmware !== null">
        <p>Now we'll need to select and upload a firmware file to load to the Launch.</p>
        <md-input-container>
          <md-file
            accept="*"
            placeholder="Click to select firmware file"
            @selected="onFirmwareFileChange" />
        </md-input-container>
      </md-step>
      <md-step md-label="Reboot to Bootloader">
        <p>Now we'll need to reboot the launch to bootloader mode.</p>
        <md-button class="md-raised md-primary" @click="RebootToBootloader">Connect and Reboot to Bootloader</md-button>
      </md-step>
      <md-step md-label="Firmware Load">
        <p>Now we'll need to load the firmware.</p>
        <md-button class="md-raised md-primary" @click="LoadFirmware">Connect and Load Firmware</md-button>
      </md-step>
      <md-step md-label="Mode Lock">
        <md-button class="md-raised md-primary" id="mode-change-button" @click="ConnectAndTryModeLock">Connect and Try Mode Lock</md-button>
      </md-step>
      <md-step md-label="Finished">
      </md-step>
    </md-stepper>
    </div>
    <div ref="patreonButton" id="patreon-button">
      <div data-reactroot="" class="_2KV-widgets-shared--patreonWidgetWrapper"><a class="sc-bxivhb ffInCX" color="primary" type="button" href="https://www.patreon.com/bePatron?u=2860444&amp;redirect_uri=http%3A%2F%2Fbuttplug.world%2Ftest.html&amp;utm_medium=widget" role="button"><div class="sc-htpNat gdWQYu"><div class="sc-gzVnrw dJCpyC" display="flex" wrap="nowrap" direction="[object Object]"><div class="sc-dnqmqq llsQFn"><span class="sc-htoDjs fqfmvk"><svg viewBox="0 0 569 546" version="1.1" xmlns="http://www.w3.org/2000/svg"><title>Patreon logo</title><g><circle data-color="1" id="Oval" cx="362.589996" cy="204.589996" r="204.589996"></circle><rect data-color="2" id="Rectangle" x="0" y="0" width="100" height="545.799988"></rect></g></svg></span></div><div class="sc-gqjmRU fFOxVX" width="1.5"></div>Give us money</div></div></a></div>
    </div>
  </div>
</template>

<script lang="ts" src="./App.ts">
</script>

<style src="vue-material/dist/vue-material.css"></style>

<style lang="css">
 @font-face {
   font-family: 'Material Icons';
   font-style: normal;
   font-weight: 400;
   src: local('Material Icons'),
   local('MaterialIcons-Regular'),
   url(../static/fonts/MaterialIcons-Regular.woff2) format('woff2');
 }

 .material-icons {
   font-family: 'Material Icons';
   font-weight: normal;
   font-style: normal;
   font-size: 24px;  /* Preferred icon size */
   display: inline-block;
   line-height: 1;
   text-transform: none;
   letter-spacing: normal;
   word-wrap: normal;
   white-space: nowrap;
   direction: ltr;

   /* Support for all WebKit browsers. */
   -webkit-font-smoothing: antialiased;
   /* Support for Safari and Chrome. */
   text-rendering: optimizeLegibility;

   /* Support for Firefox. */
   -moz-osx-font-smoothing: grayscale;

   /* Support for IE. */
   font-feature-settings: 'liga';
 }

 html, body {
   margin: 0;
   padding: 0;
   height: 100vh;
   width: 100vw;
 }

 #app {
   height: 100%;
   width: 100%;
   font-size: 16px;
   font-weight: 400;
   text-align: left;
   text-transform: none;
   font-family: Roboto,Noto Sans,Noto,sans-serif;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
   color: #2c3e50;
 }

 ._2KV-widgets-shared--patreonWidgetWrapper {
   color: #052D49;
   font-family: 'America', 'GT America', 'Lato', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
   font-size: 16px;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
   text-rendering: optimizeLegibility;
 }

 /* Patreon button rendering CSS */

 #patreon-button {
   position: absolute;
   bottom: 0;
   right: 0;
 }

 /* sc-component-id: sc-keyframes-iECmZH */
 @-webkit-keyframes iECmZH{0%{-webkit-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg);}100%{-webkit-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg);}}@keyframes iECmZH{0%{-webkit-transform:rotate(0deg);-ms-transform:rotate(0deg);transform:rotate(0deg);}100%{-webkit-transform:rotate(360deg);-ms-transform:rotate(360deg);transform:rotate(360deg);}}
 /* sc-component-id: sc-htpNat */
 .sc-htpNat {}
 .gdWQYu{visibility:visible;}
 /* sc-component-id: sc-bxivhb */
 .sc-bxivhb {}
 .ffInCX{-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:#F96854;border:2px solid #F96854;border-radius:0;box-sizing:border-box;color:#FFFFFF !important;display:inline-block;font-size:0.8090234857849197rem !important;font-weight:700;padding:0.5rem 0.75rem;position:relative;text-align:center;text-decoration:none;text-transform:uppercase;-webkit-transition:all 300ms cubic-bezier(0.19,1,0.22,1);transition:all 300ms cubic-bezier(0.19,1,0.22,1);-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;white-space:nowrap;cursor:pointer;}.ffInCX:focus{box-shadow:0 0 8px 0 #358EFF;outline:none;}.ffInCX:hover{background-color:#FA7664;border-color:#FA7664;box-shadow:0 0.25rem 0.75rem rgba(5,45,73,0.09999999999999998);}.ffInCX:active{box-shadow:none;-webkit-transform:translateY(0);-ms-transform:translateY(0);transform:translateY(0);}
 /* sc-component-id: sc-gzVnrw */
 .sc-gzVnrw {}
 .dJCpyC{-webkit-align-content:flex-start;-ms-flex-line-pack:flex-start;align-content:flex-start;-webkit-align-items:center;-webkit-box-align:center;-ms-flex-align:center;align-items:center;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-flex-grow:initial;-ms-flex-grow:initial;flex-grow:initial;-webkit-flex-wrap:nowrap;-ms-flex-wrap:nowrap;flex-wrap:nowrap;-webkit-box-pack:center;-webkit-justify-content:center;-ms-flex-pack:center;justify-content:center;styled-components:bug-fix;}@media (min-width:1rem){.dJCpyC{-webkit-flex-direction:row;-ms-flex-direction:row;flex-direction:row;}}
 /* sc-component-id: sc-htoDjs */
 .sc-htoDjs {}
 .fqfmvk{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;}.fqfmvk svg{-webkit-align-self:center;-ms-flex-item-align:center;align-self:center;height:0.75rem;width:0.75rem;}.fqfmvk svg *[data-color='1']{fill:#FFFFFF;-webkit-transition:all 300ms cubic-bezier(0.19,1,0.22,1);transition:all 300ms cubic-bezier(0.19,1,0.22,1);}.fqfmvk svg *[data-color='2']{fill:#052D49;-webkit-transition:all 300ms cubic-bezier(0.19,1,0.22,1);transition:all 300ms cubic-bezier(0.19,1,0.22,1);}
 /* sc-component-id: sc-dnqmqq */
 .sc-dnqmqq {}
 .llsQFn{-webkit-align-self:center;-ms-flex-item-align:center;align-self:center;-webkit-align-items:center;-webkit-box-align:center;-ms-flex-align:center;align-items:center;display:-webkit-inline-box !important;display:-webkit-inline-flex !important;display:-ms-inline-flexbox !important;display:inline-flex !important;padding:NaNrem;}
 /* sc-component-id: sc-gqjmRU */
 .sc-gqjmRU {}
 .fFOxVX{width:0.75rem;height:1px;}

</style>
