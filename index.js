#! /usr/bin/env node

const [sub, ...args] = process.argv.slice(2);
const currentDir = process.cwd();
const version = "0.0dev";

const PRINT_FORMAT = {};
PRINT_FORMAT.TITLE = 0;
PRINT_FORMAT.SUBTITLE = 1;
PRINT_FORMAT.LINE_BREAK = 2;
PRINT_FORMAT.OPTION = 3;

function print(format, msg) {
  switch(format) {
    case PRINT_FORMAT.TITLE:
      return console.log(msg.toUpperCase());
    case PRINT_FORMAT.LINE_BREAK:
      return console.log();
    case PRINT_FORMAT.OPTION:
      return console.log("  - " + msg);
    case PRINT_FORMAT.SUBTITLE:
      return console.log(msg);
    default:
      return console.log(format);
  }
}

const { initSub, watchSub, buildSub } = require("./lib");

switch(sub) {
  case "init":
    initSub(currentDir, args).then(
      () => {
        // print(PRINT_FORMAT.TITLE, "success!");
      },
      err => {
        print(PRINT_FORMAT.TITLE, "error!");
        if(err === "ERR_NON_EMPTY_DIR") {
          print(PRINT_FORMAT.SUBTITLE, "current directory isn't empty");

        } else {
          console.log(err);
        }
      }
    );
    break;
  case "watch":
    watchSub(currentDir, args).then(
      result => {
        // print(result);
      },
      err => {
        print(PRINT_FORMAT.TITLE, "error!");
        if(err === "ERR_MISSING_PATH") {
          print(PRINT_FORMAT.SUBTITLE, "missing required path");

        } else {
          console.log(err);
        }
      }
    );
    break;
  case "build":
    buildSub(currentDir, args).then(
      result => {
        // print(result);
      },
      err => {
        print(PRINT_FORMAT.TITLE, "error!");
        if(err === "ERR_WRONG_FILE_TYPE") {
          print(PRINT_FORMAT.SUBTITLE, "wrong file or file not found");

        } else {
          console.log(err);
        }
      }
    );
    break;
  case "version":
    print(PRINT_FORMAT.TITLE, "version: " + version);
    break;
  case "help":
    print(PRINT_FORMAT.TITLE, "help: ");
    print(PRINT_FORMAT.SUBTITLE, "Available subcommands");
    print(PRINT_FORMAT.LINE_BREAK);

    print(PRINT_FORMAT.OPTION, "init          initializes directory structure");
    print(PRINT_FORMAT.OPTION, "build         generates the whole web");
    print(PRINT_FORMAT.OPTION, "watch         same as build but with a preview server");
    print(PRINT_FORMAT.OPTION, "version       prints the script's version");
    print(PRINT_FORMAT.OPTION, "help          prints this message");
    break;
  default:
    print(PRINT_FORMAT.SUBTITLE, `unknown subcommand: ${sub}, please use 'help'`);
    break;
}
