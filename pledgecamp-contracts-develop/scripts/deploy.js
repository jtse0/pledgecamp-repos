const { defaultOptions, testingDeploy } = require('../src/utils/deploy');

const main = async () => {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts from ${deployer.address}`);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Configuration for the deployer
  const deployProfile = { ...defaultOptions };
  await testingDeploy(deployProfile);
};
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
