const fs = require('fs');
const path = require('path');

const loadVersionContractAbi = (contractName, contractVersion) => {
  const buildArchiveFolder = path.resolve(__dirname, '../build-archive');
  const abiFilePath = `${buildArchiveFolder}/${contractVersion}/${contractName}.json`;

  if(fs.existsSync(abiFilePath)) {
    console.log('Version found: ', abiFilePath);
    return JSON.parse(fs.readFileSync(abiFilePath));
  }
  console.log('ABI file for version not found!');
  return false;
};

module.exports = {
  loadVersionContractAbi,
};
