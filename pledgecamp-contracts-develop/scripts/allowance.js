require('dotenv').config();
const config = require('../src/config');

const TokenAbi = require('../build/contracts/ERC20.json');

require('@ethersproject/abstract-signer');

const main = async () => {
  const accounts = await ethers.getSigners();
  console.log(accounts[0]);
  const deployer = accounts[0];
  console.log(`Setting allowance via ${deployer.address}`);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  const Token = new ethers.Contract(config.contractTokenAddress, TokenAbi.abi, ethers.provider);
  console.log(`Token address: ${Token.address}`);
  const projectAddress = config.contractProjectAddress;
  console.log(`Project address: ${projectAddress}`);

  const maxUint = BigInt(2 ** 255);

  if(config.nodeEnv === 'development') {
    await Token.connect(deployer).approve(projectAddress, maxUint);
    await ethers.provider.sendTransaction;
  } else {
    // const iToken = new ethers.utils.Interface(TokenAbi.abi);
    // const data = iToken.connect(deployer).encodeFunctionData('approve', [projectAddress, maxUint]);

    const data = await Token.connect(deployer).approve(projectAddress, maxUint);

    const nonce = await ethers.provider.getTransactionCount(deployer.address);
    const gasPrice = 2000000000;
    const gasLimit = 30000;

    const rawTransaction = {
      data,
      nonce: ethers.utils.hexlify(nonce),
      gasPrice: ethers.utils.hexlify(gasPrice),
      gasLimit: ethers.utils.hexlify(gasLimit),
      to: Token.address,
    };
    const serializedTx = ethers.utils.serializeTransaction(rawTransaction);
    const raw = `0x${serializedTx.toHexString()}`;

    // TODO: Fix signing
    const signedTx = deployer.signTransaction(raw);
    console.log(signedTx);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
