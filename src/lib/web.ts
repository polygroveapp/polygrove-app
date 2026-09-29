// Every web page the app opens — Wikipedia, Commons, GloBI, the explorer —
// RISES FROM THE BOTTOM as a sheet (user, 2026-09-29: "have it so the web
// views come up from the bottom throughout the app"). One helper so no call
// site can drift back to the sideways push. iOS only honours the style;
// Android opens its Custom Tab the system's way.

import * as WebBrowser from 'expo-web-browser';

export const openWeb = (url: string) =>
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#81C784',
    toolbarColor: '#0d0d0d',
  });
