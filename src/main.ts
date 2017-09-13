import Vue from "vue";
import App from "./App.vue";
const VueMaterial = require("vue-material");

// Fix viewport scaling on iOS
require("viewport-units-buggyfill").init();

Vue.use(VueMaterial);

// tslint:disable-next-line no-unused-expression
new Vue({
  el: "#app",
  render: (h) => h(App),
});
