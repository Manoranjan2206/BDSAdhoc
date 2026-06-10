import jquery from 'jquery';
import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOM from 'react-dom';

// Expose React libraries to global window for Bold Reports compatibility
window.React = React;
window.createReactClass = createReactClass;
window.ReactDOM = ReactDOM;
window.$ = window.jQuery = jquery;

// Bold Reports requires these global assignments for proper functioning
window.$.fn.extend({
  // jQuery plugins used by Bold Reports
});

export { React, ReactDOM, createReactClass, jquery };