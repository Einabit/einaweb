const http = require("http");
const ecstatic = require("ecstatic");

module.exports = (root, port, fixEmptyExtension) => {

  const handler = ecstatic({
    root,
    showDir: true,
    mimeTypes: (file, defaultValue) => {
      if (fixEmptyExtension && !/\..+$/.test(file)) return "text/html";
      else return defaultValue;
    }
  });

  http.createServer(handler).listen(port);
};
