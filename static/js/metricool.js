function loadScript(callback) {
  var head = document.getElementsByTagName("head")[0];
  var script = document.createElement("script");

  script.type = "text/javascript";
  script.src = "https://tracker.metricool.com/resources/be.js";
  script.onreadystatechange = callback;
  script.onload = callback;

  head.appendChild(script);
}

loadScript(function () {
  beTracker.t({
    hash: "9c18b5b84fe2564dc527079e74b7e1b4"
  });
});
