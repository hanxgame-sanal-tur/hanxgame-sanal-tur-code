(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Marzipano = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Display the initial scene.
  switchScene(scenes[0]);

})();

},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJoYW54Z2FtZS1zYW5hbC10dXIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKlxuICogQ29weXJpZ2h0IDIwMTYgR29vZ2xlIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG4ndXNlIHN0cmljdCc7XG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIE1hcnppcGFubyA9IHdpbmRvdy5NYXJ6aXBhbm87XG4gIHZhciBib3dzZXIgPSB3aW5kb3cuYm93c2VyO1xuICB2YXIgc2NyZWVuZnVsbCA9IHdpbmRvdy5zY3JlZW5mdWxsO1xuICB2YXIgZGF0YSA9IHdpbmRvdy5BUFBfREFUQTtcblxuICAvLyBHcmFiIGVsZW1lbnRzIGZyb20gRE9NLlxuICB2YXIgcGFub0VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGFubycpO1xuICB2YXIgc2NlbmVOYW1lRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0aXRsZUJhciAuc2NlbmVOYW1lJyk7XG4gIHZhciBzY2VuZUxpc3RFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NjZW5lTGlzdCcpO1xuICB2YXIgc2NlbmVFbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNzY2VuZUxpc3QgLnNjZW5lJyk7XG4gIHZhciBzY2VuZUxpc3RUb2dnbGVFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NjZW5lTGlzdFRvZ2dsZScpO1xuICB2YXIgYXV0b3JvdGF0ZVRvZ2dsZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXV0b3JvdGF0ZVRvZ2dsZScpO1xuICB2YXIgZnVsbHNjcmVlblRvZ2dsZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZnVsbHNjcmVlblRvZ2dsZScpO1xuXG4gIC8vIERldGVjdCBkZXNrdG9wIG9yIG1vYmlsZSBtb2RlLlxuICBpZiAod2luZG93Lm1hdGNoTWVkaWEpIHtcbiAgICB2YXIgc2V0TW9kZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG1xbC5tYXRjaGVzKSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgnZGVza3RvcCcpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ21vYmlsZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdtb2JpbGUnKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdkZXNrdG9wJyk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgbXFsID0gbWF0Y2hNZWRpYShcIihtYXgtd2lkdGg6IDUwMHB4KSwgKG1heC1oZWlnaHQ6IDUwMHB4KVwiKTtcbiAgICBzZXRNb2RlKCk7XG4gICAgbXFsLmFkZExpc3RlbmVyKHNldE1vZGUpO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnZGVza3RvcCcpO1xuICB9XG5cbiAgLy8gRGV0ZWN0IHdoZXRoZXIgd2UgYXJlIG9uIGEgdG91Y2ggZGV2aWNlLlxuICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ25vLXRvdWNoJyk7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCduby10b3VjaCcpO1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgndG91Y2gnKTtcbiAgfSk7XG5cbiAgLy8gVXNlIHRvb2x0aXAgZmFsbGJhY2sgbW9kZSBvbiBJRSA8IDExLlxuICBpZiAoYm93c2VyLm1zaWUgJiYgcGFyc2VGbG9hdChib3dzZXIudmVyc2lvbikgPCAxMSkge1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgndG9vbHRpcC1mYWxsYmFjaycpO1xuICB9XG5cbiAgLy8gVmlld2VyIG9wdGlvbnMuXG4gIHZhciB2aWV3ZXJPcHRzID0ge1xuICAgIGNvbnRyb2xzOiB7XG4gICAgICBtb3VzZVZpZXdNb2RlOiBkYXRhLnNldHRpbmdzLm1vdXNlVmlld01vZGVcbiAgICB9XG4gIH07XG5cbiAgLy8gSW5pdGlhbGl6ZSB2aWV3ZXIuXG4gIHZhciB2aWV3ZXIgPSBuZXcgTWFyemlwYW5vLlZpZXdlcihwYW5vRWxlbWVudCwgdmlld2VyT3B0cyk7XG5cbiAgLy8gQ3JlYXRlIHNjZW5lcy5cbiAgdmFyIHNjZW5lcyA9IGRhdGEuc2NlbmVzLm1hcChmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHVybFByZWZpeCA9IFwidGlsZXNcIjtcbiAgICB2YXIgc291cmNlID0gTWFyemlwYW5vLkltYWdlVXJsU291cmNlLmZyb21TdHJpbmcoXG4gICAgICB1cmxQcmVmaXggKyBcIi9cIiArIGRhdGEuaWQgKyBcIi97en0ve2Z9L3t5fS97eH0uanBnXCIsXG4gICAgICB7IGN1YmVNYXBQcmV2aWV3VXJsOiB1cmxQcmVmaXggKyBcIi9cIiArIGRhdGEuaWQgKyBcIi9wcmV2aWV3LmpwZ1wiIH0pO1xuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBNYXJ6aXBhbm8uQ3ViZUdlb21ldHJ5KGRhdGEubGV2ZWxzKTtcblxuICAgIHZhciBsaW1pdGVyID0gTWFyemlwYW5vLlJlY3RpbGluZWFyVmlldy5saW1pdC50cmFkaXRpb25hbChkYXRhLmZhY2VTaXplLCAxMDAqTWF0aC5QSS8xODAsIDEyMCpNYXRoLlBJLzE4MCk7XG4gICAgdmFyIHZpZXcgPSBuZXcgTWFyemlwYW5vLlJlY3RpbGluZWFyVmlldyhkYXRhLmluaXRpYWxWaWV3UGFyYW1ldGVycywgbGltaXRlcik7XG5cbiAgICB2YXIgc2NlbmUgPSB2aWV3ZXIuY3JlYXRlU2NlbmUoe1xuICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICBnZW9tZXRyeTogZ2VvbWV0cnksXG4gICAgICB2aWV3OiB2aWV3LFxuICAgICAgcGluRmlyc3RMZXZlbDogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGxpbmsgaG90c3BvdHMuXG4gICAgZGF0YS5saW5rSG90c3BvdHMuZm9yRWFjaChmdW5jdGlvbihob3RzcG90KSB7XG4gICAgICB2YXIgZWxlbWVudCA9IGNyZWF0ZUxpbmtIb3RzcG90RWxlbWVudChob3RzcG90KTtcbiAgICAgIHNjZW5lLmhvdHNwb3RDb250YWluZXIoKS5jcmVhdGVIb3RzcG90KGVsZW1lbnQsIHsgeWF3OiBob3RzcG90LnlhdywgcGl0Y2g6IGhvdHNwb3QucGl0Y2ggfSk7XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgaW5mbyBob3RzcG90cy5cbiAgICBkYXRhLmluZm9Ib3RzcG90cy5mb3JFYWNoKGZ1bmN0aW9uKGhvdHNwb3QpIHtcbiAgICAgIHZhciBlbGVtZW50ID0gY3JlYXRlSW5mb0hvdHNwb3RFbGVtZW50KGhvdHNwb3QpO1xuICAgICAgc2NlbmUuaG90c3BvdENvbnRhaW5lcigpLmNyZWF0ZUhvdHNwb3QoZWxlbWVudCwgeyB5YXc6IGhvdHNwb3QueWF3LCBwaXRjaDogaG90c3BvdC5waXRjaCB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBkYXRhLFxuICAgICAgc2NlbmU6IHNjZW5lLFxuICAgICAgdmlldzogdmlld1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIFNldCB1cCBhdXRvcm90YXRlLCBpZiBlbmFibGVkLlxuICB2YXIgYXV0b3JvdGF0ZSA9IE1hcnppcGFuby5hdXRvcm90YXRlKHtcbiAgICB5YXdTcGVlZDogMC4wMyxcbiAgICB0YXJnZXRQaXRjaDogMCxcbiAgICB0YXJnZXRGb3Y6IE1hdGguUEkvMlxuICB9KTtcbiAgaWYgKGRhdGEuc2V0dGluZ3MuYXV0b3JvdGF0ZUVuYWJsZWQpIHtcbiAgICBhdXRvcm90YXRlVG9nZ2xlRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdlbmFibGVkJyk7XG4gIH1cblxuICAvLyBTZXQgaGFuZGxlciBmb3IgYXV0b3JvdGF0ZSB0b2dnbGUuXG4gIGF1dG9yb3RhdGVUb2dnbGVFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlQXV0b3JvdGF0ZSk7XG5cbiAgLy8gU2V0IHVwIGZ1bGxzY3JlZW4gbW9kZSwgaWYgc3VwcG9ydGVkLlxuICBpZiAoc2NyZWVuZnVsbC5lbmFibGVkICYmIGRhdGEuc2V0dGluZ3MuZnVsbHNjcmVlbkJ1dHRvbikge1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnZnVsbHNjcmVlbi1lbmFibGVkJyk7XG4gICAgZnVsbHNjcmVlblRvZ2dsZUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgIHNjcmVlbmZ1bGwudG9nZ2xlKCk7XG4gICAgfSk7XG4gICAgc2NyZWVuZnVsbC5vbignY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2NyZWVuZnVsbC5pc0Z1bGxzY3JlZW4pIHtcbiAgICAgICAgZnVsbHNjcmVlblRvZ2dsZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZW5hYmxlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVsbHNjcmVlblRvZ2dsZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZW5hYmxlZCcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnZnVsbHNjcmVlbi1kaXNhYmxlZCcpO1xuICB9XG5cbiAgLy8gU2V0IGhhbmRsZXIgZm9yIHNjZW5lIGxpc3QgdG9nZ2xlLlxuICBzY2VuZUxpc3RUb2dnbGVFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlU2NlbmVMaXN0KTtcblxuICAvLyBTdGFydCB3aXRoIHRoZSBzY2VuZSBsaXN0IG9wZW4gb24gZGVza3RvcC5cbiAgaWYgKCFkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucygnbW9iaWxlJykpIHtcbiAgICBzaG93U2NlbmVMaXN0KCk7XG4gIH1cblxuICAvLyBTZXQgaGFuZGxlciBmb3Igc2NlbmUgc3dpdGNoLlxuICBzY2VuZXMuZm9yRWFjaChmdW5jdGlvbihzY2VuZSkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNzY2VuZUxpc3QgLnNjZW5lW2RhdGEtaWQ9XCInICsgc2NlbmUuZGF0YS5pZCArICdcIl0nKTtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgc3dpdGNoU2NlbmUoc2NlbmUpO1xuICAgICAgLy8gT24gbW9iaWxlLCBoaWRlIHNjZW5lIGxpc3QgYWZ0ZXIgc2VsZWN0aW5nIGEgc2NlbmUuXG4gICAgICBpZiAoZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoJ21vYmlsZScpKSB7XG4gICAgICAgIGhpZGVTY2VuZUxpc3QoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gRE9NIGVsZW1lbnRzIGZvciB2aWV3IGNvbnRyb2xzLlxuICB2YXIgdmlld1VwRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN2aWV3VXAnKTtcbiAgdmFyIHZpZXdEb3duRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN2aWV3RG93bicpO1xuICB2YXIgdmlld0xlZnRFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ZpZXdMZWZ0Jyk7XG4gIHZhciB2aWV3UmlnaHRFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ZpZXdSaWdodCcpO1xuICB2YXIgdmlld0luRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN2aWV3SW4nKTtcbiAgdmFyIHZpZXdPdXRFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ZpZXdPdXQnKTtcblxuICAvLyBEeW5hbWljIHBhcmFtZXRlcnMgZm9yIGNvbnRyb2xzLlxuICB2YXIgdmVsb2NpdHkgPSAwLjc7XG4gIHZhciBmcmljdGlvbiA9IDM7XG5cbiAgLy8gQXNzb2NpYXRlIHZpZXcgY29udHJvbHMgd2l0aCBlbGVtZW50cy5cbiAgdmFyIGNvbnRyb2xzID0gdmlld2VyLmNvbnRyb2xzKCk7XG4gIGNvbnRyb2xzLnJlZ2lzdGVyTWV0aG9kKCd1cEVsZW1lbnQnLCAgICBuZXcgTWFyemlwYW5vLkVsZW1lbnRQcmVzc0NvbnRyb2xNZXRob2Qodmlld1VwRWxlbWVudCwgICAgICd5JywgLXZlbG9jaXR5LCBmcmljdGlvbiksIHRydWUpO1xuICBjb250cm9scy5yZWdpc3Rlck1ldGhvZCgnZG93bkVsZW1lbnQnLCAgbmV3IE1hcnppcGFuby5FbGVtZW50UHJlc3NDb250cm9sTWV0aG9kKHZpZXdEb3duRWxlbWVudCwgICAneScsICB2ZWxvY2l0eSwgZnJpY3Rpb24pLCB0cnVlKTtcbiAgY29udHJvbHMucmVnaXN0ZXJNZXRob2QoJ2xlZnRFbGVtZW50JywgIG5ldyBNYXJ6aXBhbm8uRWxlbWVudFByZXNzQ29udHJvbE1ldGhvZCh2aWV3TGVmdEVsZW1lbnQsICAgJ3gnLCAtdmVsb2NpdHksIGZyaWN0aW9uKSwgdHJ1ZSk7XG4gIGNvbnRyb2xzLnJlZ2lzdGVyTWV0aG9kKCdyaWdodEVsZW1lbnQnLCBuZXcgTWFyemlwYW5vLkVsZW1lbnRQcmVzc0NvbnRyb2xNZXRob2Qodmlld1JpZ2h0RWxlbWVudCwgICd4JywgIHZlbG9jaXR5LCBmcmljdGlvbiksIHRydWUpO1xuICBjb250cm9scy5yZWdpc3Rlck1ldGhvZCgnaW5FbGVtZW50JywgICAgbmV3IE1hcnppcGFuby5FbGVtZW50UHJlc3NDb250cm9sTWV0aG9kKHZpZXdJbkVsZW1lbnQsICAnem9vbScsIC12ZWxvY2l0eSwgZnJpY3Rpb24pLCB0cnVlKTtcbiAgY29udHJvbHMucmVnaXN0ZXJNZXRob2QoJ291dEVsZW1lbnQnLCAgIG5ldyBNYXJ6aXBhbm8uRWxlbWVudFByZXNzQ29udHJvbE1ldGhvZCh2aWV3T3V0RWxlbWVudCwgJ3pvb20nLCAgdmVsb2NpdHksIGZyaWN0aW9uKSwgdHJ1ZSk7XG5cbiAgZnVuY3Rpb24gc2FuaXRpemUocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UoJyYnLCAnJmFtcDsnKS5yZXBsYWNlKCc8JywgJyZsdDsnKS5yZXBsYWNlKCc+JywgJyZndDsnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN3aXRjaFNjZW5lKHNjZW5lKSB7XG4gICAgc3RvcEF1dG9yb3RhdGUoKTtcbiAgICBzY2VuZS52aWV3LnNldFBhcmFtZXRlcnMoc2NlbmUuZGF0YS5pbml0aWFsVmlld1BhcmFtZXRlcnMpO1xuICAgIHNjZW5lLnNjZW5lLnN3aXRjaFRvKCk7XG4gICAgc3RhcnRBdXRvcm90YXRlKCk7XG4gICAgdXBkYXRlU2NlbmVOYW1lKHNjZW5lKTtcbiAgICB1cGRhdGVTY2VuZUxpc3Qoc2NlbmUpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU2NlbmVOYW1lKHNjZW5lKSB7XG4gICAgc2NlbmVOYW1lRWxlbWVudC5pbm5lckhUTUwgPSBzYW5pdGl6ZShzY2VuZS5kYXRhLm5hbWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlU2NlbmVMaXN0KHNjZW5lKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzY2VuZUVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZWwgPSBzY2VuZUVsZW1lbnRzW2ldO1xuICAgICAgaWYgKGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpID09PSBzY2VuZS5kYXRhLmlkKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2N1cnJlbnQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2N1cnJlbnQnKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzaG93U2NlbmVMaXN0KCkge1xuICAgIHNjZW5lTGlzdEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZW5hYmxlZCcpO1xuICAgIHNjZW5lTGlzdFRvZ2dsZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZW5hYmxlZCcpO1xuICB9XG5cbiAgZnVuY3Rpb24gaGlkZVNjZW5lTGlzdCgpIHtcbiAgICBzY2VuZUxpc3RFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2VuYWJsZWQnKTtcbiAgICBzY2VuZUxpc3RUb2dnbGVFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2VuYWJsZWQnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZVNjZW5lTGlzdCgpIHtcbiAgICBzY2VuZUxpc3RFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2VuYWJsZWQnKTtcbiAgICBzY2VuZUxpc3RUb2dnbGVFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2VuYWJsZWQnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0QXV0b3JvdGF0ZSgpIHtcbiAgICBpZiAoIWF1dG9yb3RhdGVUb2dnbGVFbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZW5hYmxlZCcpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZpZXdlci5zdGFydE1vdmVtZW50KGF1dG9yb3RhdGUpO1xuICAgIHZpZXdlci5zZXRJZGxlTW92ZW1lbnQoMzAwMCwgYXV0b3JvdGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBzdG9wQXV0b3JvdGF0ZSgpIHtcbiAgICB2aWV3ZXIuc3RvcE1vdmVtZW50KCk7XG4gICAgdmlld2VyLnNldElkbGVNb3ZlbWVudChJbmZpbml0eSk7XG4gIH1cblxuICBmdW5jdGlvbiB0b2dnbGVBdXRvcm90YXRlKCkge1xuICAgIGlmIChhdXRvcm90YXRlVG9nZ2xlRWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2VuYWJsZWQnKSkge1xuICAgICAgYXV0b3JvdGF0ZVRvZ2dsZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZW5hYmxlZCcpO1xuICAgICAgc3RvcEF1dG9yb3RhdGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXV0b3JvdGF0ZVRvZ2dsZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZW5hYmxlZCcpO1xuICAgICAgc3RhcnRBdXRvcm90YXRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlTGlua0hvdHNwb3RFbGVtZW50KGhvdHNwb3QpIHtcblxuICAgIC8vIENyZWF0ZSB3cmFwcGVyIGVsZW1lbnQgdG8gaG9sZCBpY29uIGFuZCB0b29sdGlwLlxuICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgd3JhcHBlci5jbGFzc0xpc3QuYWRkKCdob3RzcG90Jyk7XG4gICAgd3JhcHBlci5jbGFzc0xpc3QuYWRkKCdsaW5rLWhvdHNwb3QnKTtcblxuICAgIC8vIENyZWF0ZSBpbWFnZSBlbGVtZW50LlxuICAgIHZhciBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgaWNvbi5zcmMgPSAnaW1nL2xpbmsucG5nJztcbiAgICBpY29uLmNsYXNzTGlzdC5hZGQoJ2xpbmstaG90c3BvdC1pY29uJyk7XG5cbiAgICAvLyBTZXQgcm90YXRpb24gdHJhbnNmb3JtLlxuICAgIHZhciB0cmFuc2Zvcm1Qcm9wZXJ0aWVzID0gWyAnLW1zLXRyYW5zZm9ybScsICctd2Via2l0LXRyYW5zZm9ybScsICd0cmFuc2Zvcm0nIF07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmFuc2Zvcm1Qcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJvcGVydHkgPSB0cmFuc2Zvcm1Qcm9wZXJ0aWVzW2ldO1xuICAgICAgaWNvbi5zdHlsZVtwcm9wZXJ0eV0gPSAncm90YXRlKCcgKyBob3RzcG90LnJvdGF0aW9uICsgJ3JhZCknO1xuICAgIH1cblxuICAgIC8vIEFkZCBjbGljayBldmVudCBoYW5kbGVyLlxuICAgIHdyYXBwZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgIHN3aXRjaFNjZW5lKGZpbmRTY2VuZUJ5SWQoaG90c3BvdC50YXJnZXQpKTtcbiAgICB9KTtcblxuICAgIC8vIFByZXZlbnQgdG91Y2ggYW5kIHNjcm9sbCBldmVudHMgZnJvbSByZWFjaGluZyB0aGUgcGFyZW50IGVsZW1lbnQuXG4gICAgLy8gVGhpcyBwcmV2ZW50cyB0aGUgdmlldyBjb250cm9sIGxvZ2ljIGZyb20gaW50ZXJmZXJpbmcgd2l0aCB0aGUgaG90c3BvdC5cbiAgICBzdG9wVG91Y2hBbmRTY3JvbGxFdmVudFByb3BhZ2F0aW9uKHdyYXBwZXIpO1xuXG4gICAgLy8gQ3JlYXRlIHRvb2x0aXAgZWxlbWVudC5cbiAgICB2YXIgdG9vbHRpcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvb2x0aXAuY2xhc3NMaXN0LmFkZCgnaG90c3BvdC10b29sdGlwJyk7XG4gICAgdG9vbHRpcC5jbGFzc0xpc3QuYWRkKCdsaW5rLWhvdHNwb3QtdG9vbHRpcCcpO1xuICAgIHRvb2x0aXAuaW5uZXJIVE1MID0gZmluZFNjZW5lRGF0YUJ5SWQoaG90c3BvdC50YXJnZXQpLm5hbWU7XG5cbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGljb24pO1xuICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XG5cbiAgICByZXR1cm4gd3JhcHBlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluZm9Ib3RzcG90RWxlbWVudChob3RzcG90KSB7XG5cbiAgICAvLyBDcmVhdGUgd3JhcHBlciBlbGVtZW50IHRvIGhvbGQgaWNvbiBhbmQgdG9vbHRpcC5cbiAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHdyYXBwZXIuY2xhc3NMaXN0LmFkZCgnaG90c3BvdCcpO1xuICAgIHdyYXBwZXIuY2xhc3NMaXN0LmFkZCgnaW5mby1ob3RzcG90Jyk7XG5cbiAgICAvLyBDcmVhdGUgaG90c3BvdC90b29sdGlwIGhlYWRlci5cbiAgICB2YXIgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgaGVhZGVyLmNsYXNzTGlzdC5hZGQoJ2luZm8taG90c3BvdC1oZWFkZXInKTtcblxuICAgIC8vIENyZWF0ZSBpbWFnZSBlbGVtZW50LlxuICAgIHZhciBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGljb25XcmFwcGVyLmNsYXNzTGlzdC5hZGQoJ2luZm8taG90c3BvdC1pY29uLXdyYXBwZXInKTtcbiAgICB2YXIgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgIGljb24uc3JjID0gJ2ltZy9pbmZvLnBuZyc7XG4gICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdpbmZvLWhvdHNwb3QtaWNvbicpO1xuICAgIGljb25XcmFwcGVyLmFwcGVuZENoaWxkKGljb24pO1xuXG4gICAgLy8gQ3JlYXRlIHRpdGxlIGVsZW1lbnQuXG4gICAgdmFyIHRpdGxlV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRpdGxlV3JhcHBlci5jbGFzc0xpc3QuYWRkKCdpbmZvLWhvdHNwb3QtdGl0bGUtd3JhcHBlcicpO1xuICAgIHZhciB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRpdGxlLmNsYXNzTGlzdC5hZGQoJ2luZm8taG90c3BvdC10aXRsZScpO1xuICAgIHRpdGxlLmlubmVySFRNTCA9IGhvdHNwb3QudGl0bGU7XG4gICAgdGl0bGVXcmFwcGVyLmFwcGVuZENoaWxkKHRpdGxlKTtcblxuICAgIC8vIENyZWF0ZSBjbG9zZSBlbGVtZW50LlxuICAgIHZhciBjbG9zZVdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjbG9zZVdyYXBwZXIuY2xhc3NMaXN0LmFkZCgnaW5mby1ob3RzcG90LWNsb3NlLXdyYXBwZXInKTtcbiAgICB2YXIgY2xvc2VJY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgY2xvc2VJY29uLnNyYyA9ICdpbWcvY2xvc2UucG5nJztcbiAgICBjbG9zZUljb24uY2xhc3NMaXN0LmFkZCgnaW5mby1ob3RzcG90LWNsb3NlLWljb24nKTtcbiAgICBjbG9zZVdyYXBwZXIuYXBwZW5kQ2hpbGQoY2xvc2VJY29uKTtcblxuICAgIC8vIENvbnN0cnVjdCBoZWFkZXIgZWxlbWVudC5cbiAgICBoZWFkZXIuYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuICAgIGhlYWRlci5hcHBlbmRDaGlsZCh0aXRsZVdyYXBwZXIpO1xuICAgIGhlYWRlci5hcHBlbmRDaGlsZChjbG9zZVdyYXBwZXIpO1xuXG4gICAgLy8gQ3JlYXRlIHRleHQgZWxlbWVudC5cbiAgICB2YXIgdGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRleHQuY2xhc3NMaXN0LmFkZCgnaW5mby1ob3RzcG90LXRleHQnKTtcbiAgICB0ZXh0LmlubmVySFRNTCA9IGhvdHNwb3QudGV4dDtcblxuICAgIC8vIFBsYWNlIGhlYWRlciBhbmQgdGV4dCBpbnRvIHdyYXBwZXIgZWxlbWVudC5cbiAgICB3cmFwcGVyLmFwcGVuZENoaWxkKGhlYWRlcik7XG4gICAgd3JhcHBlci5hcHBlbmRDaGlsZCh0ZXh0KTtcblxuICAgIC8vIENyZWF0ZSBhIG1vZGFsIGZvciB0aGUgaG90c3BvdCBjb250ZW50IHRvIGFwcGVhciBvbiBtb2JpbGUgbW9kZS5cbiAgICB2YXIgbW9kYWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBtb2RhbC5pbm5lckhUTUwgPSB3cmFwcGVyLmlubmVySFRNTDtcbiAgICBtb2RhbC5jbGFzc0xpc3QuYWRkKCdpbmZvLWhvdHNwb3QtbW9kYWwnKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1vZGFsKTtcblxuICAgIHZhciB0b2dnbGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHdyYXBwZXIuY2xhc3NMaXN0LnRvZ2dsZSgndmlzaWJsZScpO1xuICAgICAgbW9kYWwuY2xhc3NMaXN0LnRvZ2dsZSgndmlzaWJsZScpO1xuICAgIH07XG5cbiAgICAvLyBTaG93IGNvbnRlbnQgd2hlbiBob3RzcG90IGlzIGNsaWNrZWQuXG4gICAgd3JhcHBlci5xdWVyeVNlbGVjdG9yKCcuaW5mby1ob3RzcG90LWhlYWRlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlKTtcblxuICAgIC8vIEhpZGUgY29udGVudCB3aGVuIGNsb3NlIGljb24gaXMgY2xpY2tlZC5cbiAgICBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuaW5mby1ob3RzcG90LWNsb3NlLXdyYXBwZXInKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZSk7XG5cbiAgICAvLyBQcmV2ZW50IHRvdWNoIGFuZCBzY3JvbGwgZXZlbnRzIGZyb20gcmVhY2hpbmcgdGhlIHBhcmVudCBlbGVtZW50LlxuICAgIC8vIFRoaXMgcHJldmVudHMgdGhlIHZpZXcgY29udHJvbCBsb2dpYyBmcm9tIGludGVyZmVyaW5nIHdpdGggdGhlIGhvdHNwb3QuXG4gICAgc3RvcFRvdWNoQW5kU2Nyb2xsRXZlbnRQcm9wYWdhdGlvbih3cmFwcGVyKTtcblxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG5cbiAgLy8gUHJldmVudCB0b3VjaCBhbmQgc2Nyb2xsIGV2ZW50cyBmcm9tIHJlYWNoaW5nIHRoZSBwYXJlbnQgZWxlbWVudC5cbiAgZnVuY3Rpb24gc3RvcFRvdWNoQW5kU2Nyb2xsRXZlbnRQcm9wYWdhdGlvbihlbGVtZW50LCBldmVudExpc3QpIHtcbiAgICB2YXIgZXZlbnRMaXN0ID0gWyAndG91Y2hzdGFydCcsICd0b3VjaG1vdmUnLCAndG91Y2hlbmQnLCAndG91Y2hjYW5jZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICd3aGVlbCcsICdtb3VzZXdoZWVsJyBdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXZlbnRMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnRMaXN0W2ldLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRTY2VuZUJ5SWQoaWQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNjZW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHNjZW5lc1tpXS5kYXRhLmlkID09PSBpZCkge1xuICAgICAgICByZXR1cm4gc2NlbmVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRTY2VuZURhdGFCeUlkKGlkKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLnNjZW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGRhdGEuc2NlbmVzW2ldLmlkID09PSBpZCkge1xuICAgICAgICByZXR1cm4gZGF0YS5zY2VuZXNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gRGlzcGxheSB0aGUgaW5pdGlhbCBzY2VuZS5cbiAgc3dpdGNoU2NlbmUoc2NlbmVzWzBdKTtcblxufSkoKTtcbiJdfQ==
