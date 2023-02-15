const http = require("http");
const ecstatic = require("ecstatic");

module.exports = (root, port, fixEmptyExtension) => {

  const handler = ecstatic({
    root,
    showDir: true,
    mimeTypes: file =>
      fixEmptyExtension && !/\..+$/.test(file) && "text/html"
  });

  http.createServer(handler).listen(port);
};
