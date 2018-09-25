import Vue from 'apostrophe/vue';

export default function() {
  /* eslint-disable no-new */
  new Vue({
    el: '#apos-admin-bar',
    template: '<component :is="`TheApostropheAdminBar`" :items="apos.adminBar.items" />',
    computed: {
      apos () {
        return window.apos;
      }
    }
  });
};