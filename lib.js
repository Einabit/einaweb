const FileWrapper = require("./filew");
const launch = require("./static");
const ejs = require("ejs");
const dlv = require("dlv");
const { exec } = require("child_process");

const FILENAME_FROM_PATH_RX = /.*\/(.+)\..+$/;

const filew = new FileWrapper;

const parseInstructions = filecontent => {
  const instrRegEx = /^<%#einaweb:(.+\s?.*)%>/;
  const getInstruction = line => line && instrRegEx.exec(line);
  return filecontent.split("\n").reduce((acc, cur) => {
    const inst = getInstruction(cur);
    if(!inst) return acc;
    else {
      return [ ...acc, inst[1]];
    }
  }, []);
}

const loadJson = path => {
  return filew.readFile(path).then(contents => {
    return JSON.parse(contents);
  }).catch(err => {
    console.log("Error loading JSON file: " + path);
    return undefined;
  })
}

const chainPromises = (invokers, result) => {
  const currentPromise = invokers.shift();
  if(currentPromise) return currentPromise().then(res => chainPromises(invokers, res));
  else return Promise.resolve(result);
}

const processTemplate = filePath => {
  let descriptorResult = {};
  return filew.readFile(filePath).then(fileContents => {
    descriptorResult.path = filePath;
    descriptorResult.content = fileContents;
    descriptorResult.data = {};
    const instructions = parseInstructions(fileContents);
    return chainPromises(instructions.reduce((tasks, inst) => {
      const [cmd, ...arg] = inst.split(" ");
      let kn, file, expression;
      switch(cmd) {
        case "load":
          // preload content from json file. Multiple invocations will override [data] value
          [kn, file] = arg;
          tasks.push(() => {
            return loadJson(file).then(cnt => {
              descriptorResult.data[kn] = cnt;
            });
          })
          break;
        case "pick":
          // reasign data to json path (after load)
          [kn, expression] = arg;
          tasks.push(() => {
            descriptorResult.data[kn] = dlv(descriptorResult.data[kn], expression);
            return Promise.resolve();
          });
          break;
        case "each":
          // generates a file for each entry in data[kn]
          [kn, expression] = arg;
          tasks.push(() => {
            if (expression) {
              descriptorResult.each = dlv(descriptorResult.data[kn], expression);
            } else {
              descriptorResult.each = descriptorResult.data[kn];
            }
            return Promise.resolve();
          });
          break;
        case "name":
          // overrides file name
          tasks.push(() => {
            descriptorResult.generateName = ($data, $each, $file) => eval(arg[0]);
            return Promise.resolve();
          });
          break;
      }
      return tasks;
    }, [])).then(() => descriptorResult);
  });
}

const renderEJSTemplate = (content, data, each, file) => {
  return ejs.render(content, { $each: each, $file: file, $data: {...data} }, { views: ["templates"] }).trim();
}

const onlyTemplates = fileName => fileName.endsWith(".ejs"); // we do not want to include files that contain include files - keyword \inc\ ?

const self = {};

self.initSub = async function(cwd, args) {

  const contents = await filew.readFolder(".");

  if(contents.length) throw "ERR_NON_EMPTY_DIR";

  await Promise.all(["templates", "public"].map(dir =>
    filew.mkdir([cwd, dir].join("/"))));
}

self.watchSub = async function(cwd, args) {
  const fixEmpty = "FIX_EMPTY_EXTENSION";

  const publicFolderPath = [cwd, "public"].join("/");

  launch(publicFolderPath, 8080, args.includes(fixEmpty));
  console.log(`serving ${publicFolderPath} in http:/localhost:8080/`)
  self.buildSub(cwd, ["quiet"])
  filew.watchPath("templates", filename => {
    if (onlyTemplates(filename)) {
      self.buildSub(cwd, ["quiet", "path=templates/" + filename]);
    } else {
      self.buildSub(cwd, ["quiet"]);
    }
  });
}

self.buildSub = async function(cwd, args = []) {
  const modificators = ["quiet", "path"];
  let options = {};


  args.forEach(arg => {
    const apply = modificators.find(mod => arg.startsWith(mod));
    if(apply) {
      switch(apply) {
        case "quiet":
          options.quiet = true;
          break;

        case "path":
          if(!onlyTemplates(arg)) throw "ERR_WRONG_FILE_TYPE";
          options.path = arg.replace("path=", "");
          break;
      }
    }
  });

  function buildTemplate(path) {
    return processTemplate(path).then(desc => {
      function innerBuild(desc, each) {
        const [, originalFile ] = path.match(FILENAME_FROM_PATH_RX);
        let fileName;
        if (typeof desc.generateName !== "function") {
          fileName = originalFile + ".html";
        } else {
          fileName = desc.generateName(desc.data, each, originalFile);
        }
        const result = renderEJSTemplate(desc.content, desc.data, each, originalFile);
        let writePath = ["public", fileName].join("/");
        if(!options.quiet) console.log("compiled " + fileName);
        filew.writeFile(writePath, result);
      }
      if(desc.each) {
        desc.each.forEach(dataItem => {
          innerBuild(desc, dataItem);
        });
      } else {
        innerBuild(desc);
      }
    });
  }

  if(!options.path) {
    let templateFiles = await filew.readFolder("templates");
    templateFiles = templateFiles.filter(onlyTemplates).map(file => ["templates", file].join("/"));
    Promise.all(templateFiles.map(buildTemplate))
  } else {
    buildTemplate(options.path);
  }
}

module.exports = self;
