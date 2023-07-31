require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const config = require('../src/config');

const backupContracts = () => {
  const buildFolder = path.resolve(__dirname, config.contractsSourcePath);
  if(fs.existsSync(buildFolder)) {
    console.log('Contract files found!');
    const archiveVersionNumber = config.contractVersion;
    const targetDirectory = path.resolve(__dirname, config.contractsCompiledPath);
    const targetFolder = path.resolve(__dirname, `${targetDirectory}/${archiveVersionNumber}`);

    if(!fs.existsSync(targetDirectory)) {
      console.log('Creating archive directory...');
      fs.mkdirSync(targetDirectory);
    }

    fs.copy(buildFolder, targetFolder, (err) => {
      if(err) {
        return console.error(err)
      }
      console.log('Successfully backed up contract json files to:', targetFolder);
      return true;
    });
  }
};

backupContracts();

module.exports = {
  backupContracts,
};
