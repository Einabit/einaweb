const fs = require("fs");
const path = require("path");
const rline = require("readline");

function FileWrapper() {}

FileWrapper.getPath = function(_path) {
  return path.join(process.cwd(), _path);
}

FileWrapper.getAbsPath = function(_folder, _path) {
  return path.join(_folder, _path);
}

FileWrapper.prototype.mkdir = function(_path) {
  return new Promise((resolve, reject) => fs.mkdir(_path, { recursive: true }, err => !err || (err && err.code === 'EEXIST') ? resolve(): reject(err)));
}

FileWrapper.prototype.fsync = function(_path) {
  return new Promise((resolve, reject) => {
    fs.open(_path, "r", (err, fd) => {
      if(err) reject(err);
      else fs.fsync(fd, () => {
        if(err) reject(err);
        else resolve();
      })
    })
  });
}

FileWrapper.prototype.readFile = function(_path) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.readFile(path, "utf8", (err, data) => err ? reject(err) : resolve(data)));
}

FileWrapper.prototype.createReadStream = function(_path) {
  return fs.createReadStream(_path);
}

FileWrapper.prototype.readByLine = function(_path, cbk) {
  return new Promise(resolve => {
    const path = FileWrapper.getPath(_path);
    const rl = rline.createInterface({
      input: this.createReadStream(path),
      crlfDelay: Infinity
    });
    rl.on("line", cbk);
    rl.on("close", resolve);
  });
}

FileWrapper.prototype.clearFile = function(_path) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.writeFile(path, "", "utf8", (err) => err ? reject(err) : resolve()));
}

FileWrapper.prototype.writeLine = function(_path) {
  console.trace("deprecated method, use ::appendFile instead");
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.appendFile(path, content + "\n", "utf8", (err) => err ? reject(err) : resolve()));
}

FileWrapper.prototype.writeFile = function(_path, content) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.writeFile(path, content, "utf8", (err) => err ? reject(err) : resolve()));
}

FileWrapper.prototype.appendFile = function(_path, content) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.appendFile(path, content, "utf8", (err) => err ? reject(err) : resolve()));
}

FileWrapper.prototype.resolveFilePath = function(_folder, _path) {
  return FileWrapper.getAbsPath(_folder, _path);
}

FileWrapper.prototype.isFileReadable = function(_filepath) {
  return new Promise((resolve, reject) => fs.access(_filepath, fs.constants.R_OK, err => err ? reject(err): resolve()));
}

FileWrapper.prototype.removeFile = function(_path) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.unlink(path, err => err ? reject(err): resolve()));
}

FileWrapper.prototype.writeStreamToPath = function(_path, _stream) {
  const writest = this.createWriteStream(_path);
  _stream.pipe(writest);
}

FileWrapper.prototype.watchPath = function(_path, onChange) {
  const watcher = fs.watch(_path, (evtType, filename) => evtType === "change" && onChange(filename));
  return () => watcher.close();
}

FileWrapper.prototype.readFolder = function(_path) {
  const path = FileWrapper.getPath(_path);
  return new Promise((resolve, reject) => fs.readdir(path, (err, content) => err ? reject(err): resolve(content)));
}

FileWrapper.prototype.createWriteStream = function(_path) {
  const path = FileWrapper.getPath(_path);
  return fs.createWriteStream(path);
}

FileWrapper.prototype.writeLineOnStream = function(ws, content) {
  ws.write(content + "\n");
}

module.exports = FileWrapper;
