const FileWrapper = require("./filew");
const launch = require("./static");
const ejs = require("ejs");
const dlv = require("dlv");
const { exec } = require("child_process");

const filew = new FileWrapper;

const parseInstructions = filecontent => {
  const instrRegEx = /^<%#einaweb:(.+\s?.*)%>/;
  const getInstruction = line => line && instrRegEx.exec(line);
  return filecontent.split("\n").reduce((acc, cur) => {
    const inst = getInstruction(cur);
    if(!inst) return acc;
    else {
      const [line, cmd] = inst;
      return [ ...acc, cmd.split(" ")];
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

const buildName = (repl, data = {}) => {
  const keys = Object.keys(data);
  if(!keys.length) return repl;
  const toBeReplaced = keys.filter(key => repl.includes("$" + key));
  if(!toBeReplaced.length) return repl;
  else return toBeReplaced.reduce((acc, cur) => acc.replace("$" + cur, data[cur]), repl);
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
    const instructions = parseInstructions(fileContents);
    return chainPromises(instructions.reduce((tasks, inst) => {
      const [cmd, arg] = inst;
      switch(cmd) {
        case "require":
          // preload content from json file. Multiple invocations will override [data] value
          tasks.push(() => {
            return loadJson(arg).then(data => {
              return descriptorResult.data = data;
            });
          })
          break;
        case "pick":
          // reasign data to json path (after require)
          tasks.push(() => {
            descriptorResult.data = dlv(descriptorResult.data, arg);
            return Promise.resolve();
          });
          break;
        case "each":
          // generates a file for each entry in data (after require)
          tasks.push(() => {
            descriptorResult.each = Array.isArray(descriptorResult.data);
            return Promise.resolve();
          });
          break;
        case "name":
          // overrides file name
          tasks.push(() => {
            descriptorResult.generateName = data => buildName(arg, data);
            return Promise.resolve();
          });
          break;
      }
      return tasks;
    }, [])).then(() => descriptorResult);
  });
}

const renderEJSTemplate = (content, data, file) => {
  return ejs.render(content, { data, file }, { views: ["templates"] }).trim();
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
      function innerBuild(desc, data) {
        const fileName = desc.generateName(data);
        const result = renderEJSTemplate(desc.content, data, fileName);
        let writePath = ["public", fileName].join("/");
        if(!options.quiet) console.log("compiled " + fileName);
        filew.writeFile(writePath, result);
      }
      if(desc.each) {
        desc.data.forEach(dataItem => innerBuild(desc, dataItem));
      } else {
        innerBuild(desc, desc.data);
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
