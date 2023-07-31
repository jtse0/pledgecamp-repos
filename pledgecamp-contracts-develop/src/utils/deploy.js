const {
  assertBN,
  toEthTime,
  toSafeNumber,
  account,
  toBN,
  blockDate,
  addDays,
} = require('./testing');

const config = require('../config');

Error.stackTraceLimit = Infinity;

// TODO Refactor to be more dynamic / pickup from environment
const defaultOptions = {
  AccountManager: { address: null, deploy: true },
  AccountStorage: { address: null, deploy: true },
  Administrator: { address: null, deploy: true },
  CampShareManager: { address: null, deploy: true },
  CampShareStorage: {
    address: null,
    deploy: true,
    unstakePeriod: config.unstakePeriod,
    outstandingAllowance: config.outstandingAllowance,
  },
  Moderator: { address: null, deploy: true },
  PLGProjectFactory: { address: null, deploy: true },
  PLGProject: {
    address: null,
    deploy: true,
    projectId: 1,
    creatorAddress: null,
    milestones: 5, // Either number of milestones to process or array with eth dates
    milestoneInterval: 10, // Days
    fee: 5, // In percents
  },
  Token: {
    // Will only need to be deployed in development
    address: null,
    deploy: true,
    fundTotal: toBN('4200e3'),
  },
  accounts: {
    // Owner account used as core token worker during setup
    owner: account(0, '5000e3', 1, true),
  },
};

// NOTE These functions require ethers to already be available globally. I.E. Use through hardhat CLI
const deployToken = async (accounts) => {
  const initAddresses = [];
  const initAllocations = [];
  Object.values(accounts).forEach((acc) => {
    initAddresses.push(acc.signer.address);
    initAllocations.push(toSafeNumber(acc.balance));
  });
  const TokenF = await ethers.getContractFactory('ERC20');
  const token = await TokenF.deploy('PLG', 'PLGToken');
  await token.deployed();
  await token.initialize(initAddresses, initAllocations);
  await token.unlock();
  // Do it this way to be non-blocking
  const functionPromises = Object.entries(accounts).map(async ([accountName, acc]) => {
    const accountBalance = await token.balanceOf(acc.address);
    assertBN(accountBalance, acc.balance, `${accountName} not issued correct tokens`);
  });
  await Promise.all(functionPromises);
  return token;
};

const deployAdministrator = async (tokenAddress) => {
  const Administrator = await ethers.getContractFactory('Administrator');
  const administrator = await Administrator.deploy(tokenAddress);
  await administrator.deployed();
  return administrator;
};

const deployAccountStorage = async ({ tokenOwnerAddress, Token, accounts }) => {
  const AccountStorageF = await ethers.getContractFactory('AccountStorage');
  const accountStorage = await AccountStorageF.deploy(Token.address);

  // Check that balances are being transferred from the owner address to AccountStorage
  let ownerBalance = await Token.balanceOf(tokenOwnerAddress);
  const expectedBalance = ownerBalance - Token.fundTotal;
  await Token.transfer(accountStorage.address, Token.fundTotal);
  ownerBalance = await Token.balanceOf(tokenOwnerAddress);
  assertBN(ownerBalance, expectedBalance, 'TokenOwner -> AccountStorage token transfer error');

  const functionPromises = Object.entries(accounts).map(async ([accountName, acc]) => {
    if(!acc.unmanaged) {
      await accountStorage.increaseBalance(acc.accountId, acc.balance);
      const balance = await accountStorage.balanceOf(acc.accountId);
      assertBN(balance, acc.balance, `AccountStorage increaseBalance for ${accountName} error`);
    }
  });

  await Promise.all(functionPromises);
  await accountStorage.deployed();
  return accountStorage;
};

const deployAccountManager = async ({ AccountStorage, Administrator }) => {
  const AccountManagerF = await ethers.getContractFactory('AccountManager');
  const accountManager = await AccountManagerF.deploy(AccountStorage.address);
  await accountManager.setAdministrator(Administrator.address);
  await AccountStorage.setAccountManager(accountManager.address);
  await accountManager.deployed();
  return accountManager;
};

const deployCampShareStorage = async ({
  tokenAddress,
  unstakePeriod,
  outstandingAllowance,
}) => {
  const CampShareStorageF = await ethers.getContractFactory('CampShareStorage');
  const campShareStorage = await CampShareStorageF.deploy(
    tokenAddress,
    unstakePeriod,
  );
  await campShareStorage.setOutstandingAllowance(outstandingAllowance);
  await campShareStorage.deployed();
  return campShareStorage;
};

const deployCampShareManager = async ({
  AccountStorage,
  AccountManager,
  Administrator,
  CampShareStorage,
  Token,
}) => {
  const CampShareManagerF = await ethers.getContractFactory('CampShareManager');
  const campShareManager = await CampShareManagerF.deploy(
    Token.address,
    Administrator.address,
    AccountStorage.address,
    CampShareStorage.address,
  );
  await CampShareStorage.setCampshareManager(campShareManager.address);
  await AccountManager.setCampShare(campShareManager.address);
  await Administrator.setCampShare(campShareManager.address);
  await campShareManager.setAdmin(Administrator.address);
  await campShareManager.deployed();
  return campShareManager;
};

const deployModerator = async (CampShareManager) => {
  const ModeratorF = await ethers.getContractFactory('Moderator');
  const moderator = await ModeratorF.deploy(CampShareManager.address);
  await CampShareManager.setModeratorContract(moderator.address);
  await moderator.deployed();
  return moderator;
};

const deployDummyProject = async () => {
  const PLGProjectF = await ethers.getContractFactory('PLGProject');
  return PLGProjectF.deploy();
};

const deployProjectFactory = async (proxyProjectAddress) => {
  const PLGProjectFactoryF = await ethers.getContractFactory('PLGProjectFactory');
  const projectFactory = await PLGProjectFactoryF.deploy(proxyProjectAddress);
  await projectFactory.deployed();
  return projectFactory;
};

const deployProject = async (options) => {
  const block = await ethers.provider.getBlock('latest');
  const { PLGProject, PLGProjectFactory, Administrator, accounts } = options;
  const { milestones, milestoneInterval, releasePercents, fee } = PLGProject;

  const fundingAccount = accounts.owner.address;

  let numberOfMilestones = milestones;
  let milestoneArray = [];

  // Construct milestones array
  if(Number.isInteger(milestones)) {
    for(let i = 1; i <= milestones; i += 1) {
      const days = i * milestoneInterval;
      const date = toEthTime(addDays(block.timestamp * 1000, days));
      milestoneArray.push(date.toString());
    }
  } else {
    milestoneArray = milestones;
    numberOfMilestones = milestones.length;
    milestoneArray.forEach((milestoneValue, index) => {
      if(index !== 0) {
        assert(
          milestoneValue > milestoneArray[index - 1],
          `Milestone must be > previous.
          Got ${milestoneValue}, previous ${milestoneArray[index - 1]}`,
        );
      }
      const date = blockDate(ethers.provider);
      assert(
        milestoneValue > date,
        `Milestone must be > current block time.
        Got ${milestoneValue}, blockDate ${date}`,
      );
    });
  }

  // Construct release percentage array
  let releasePercentageArray = [];
  let releaseTotal;
  if(Array.isArray(releasePercents)) {
    releasePercentageArray = releasePercents;
    releaseTotal = releasePercentageArray.reduce((a, b) => a + b, 0);
    if(releaseTotal !== 100) {
      throw new Error(`Release percentage array should total 100. Got ${releaseTotal}`);
    }
  } else {
    const releasePercentage = Math.floor(100 / numberOfMilestones);
    releasePercentageArray = new Array(numberOfMilestones).fill(releasePercentage);
    releaseTotal = releasePercentage * numberOfMilestones;
    // If the cumulative release percentage doesn't total 100%, add difference to first release
    if(releaseTotal !== 100) {
      releasePercentageArray[0] = releasePercentage + (100 - releaseTotal);
    }
  }
  if(milestoneArray.length !== releasePercentageArray.length) {
    throw new Error(
      `Milestones array should be same length as Release percentage array.
      Got ${milestoneArray.length} milestones and ${releasePercentageArray.length} release percentages`,
    );
  }

  let creator = options.AccountManager.address;
  let recipient = options.AccountStorage.address;
  if(options.PLGProject.creatorAddress !== null) {
    creator = options.PLGProject.creatorAddress;
    recipient = creator;
  }

  const { projectId } = options.PLGProject;
  await PLGProjectFactory.createChild(
    projectId,
    options.Token.address,
    options.Administrator.address,
    options.AccountStorage.address,
    fundingAccount,
    creator,
    recipient,
    milestoneArray,
    releasePercentageArray,
  );

  const projectAddress = (await PLGProjectFactory.getChildAddress(projectId))[0];
  await Administrator.setProjectInfo(projectAddress, fee);
  return ethers.getContractAt('PLGProject', projectAddress);
};

/** Wrap a Hardhat/ethers contract function
 *
 * Params wrapped with toSafeNumber:
 *    uint
 *    items in Array of uint
 * Return values:
 *    uint converted to BigInt
*/
const contractFnProxy = (contract, fnAbi) => {
  const { inputs, name, outputs } = fnAbi;
  let fn = contract.functions[name];
  return async (...args) => {
    // Parse optional signer input, and wrap `connect` function
    if(args.length > inputs.length) {
      const { signer } = args[inputs.length];
      if(signer) {
        fn = contract.connect(signer)[name];
      }
    }
    // Parse args and return value
    const result = await fn(...args.slice(0, inputs.length).map((arg, index) => {
      const abi = inputs[index];
      if(abi.type.includes('uint')) {
        // Handle uint array args
        if(abi.type.includes('[]')) {
          return arg.map(toSafeNumber);
        }
        return toSafeNumber(arg);
      }
      return arg;
    }));
    if(outputs && outputs.length && outputs[0].type.includes('uint')) {
      try {
        return toBN(result);
      } catch(err) {
        // TODO Check how to retrieve return values from ethers.io
        return result;
      }
    }
    return result;
  };
};

const setupContract = async (options, name, contractPromise) => {
  const contract = await contractPromise;
  options[name].address = contract.address;
  options[name].contract = contract;
  Object.values(contract.interface.functions).forEach((fnAbi) => {
    options[name][fnAbi.name] = contractFnProxy(contract, fnAbi);
  });
  return options;
};

const testingDeploy = async (options) => {
  const signerAccounts = await ethers.getSigners();
  if(options.Token.deploy) {
    Object.keys(options.accounts || {}).forEach((accKey) => {
      const acc = options.accounts[accKey];
      options.accounts[accKey] = {
        ...acc,
        signer: signerAccounts[acc.bipIndex],
        address: signerAccounts[acc.bipIndex].address,
      };
    });
    await setupContract(options, 'Token', deployToken(options.accounts));
  }

  if(options.Administrator.deploy) {
    if(!options.Token.address) {
      throw Error('Administrator deploy. Token address required');
    }
    await setupContract(options, 'Administrator', deployAdministrator(options.Token.address));
  }

  if(options.AccountStorage.deploy) {
    if(!options.Token.address) {
      throw Error('AccountStorage deploy. Token address required');
    }
    await setupContract(options, 'AccountStorage', deployAccountStorage({
      ...options,
      tokenOwnerAddress: options.accounts.owner.address,
    }));
  }

  if(options.AccountManager.deploy) {
    if(!options.AccountStorage.address) {
      throw Error('AccountManager deploy. AccountStorage address required');
    }
    await setupContract(options, 'AccountManager', deployAccountManager(options));
  }

  if(options.CampShareStorage.deploy) {
    await setupContract(options, 'CampShareStorage', deployCampShareStorage({
      ...options.CampShareStorage,
      tokenAddress: options.Token.address,
    }));
  }

  if(options.CampShareManager.deploy) {
    if(!options.AccountStorage.address) {
      throw Error('CampShareManager deploy. AccountStorage address required');
    }
    if(!options.Administrator.address) {
      throw Error('CampShareManager deploy. Administrator address required');
    }
    if(!options.CampShareStorage.address) {
      throw Error('CampShareManager deploy. CampShareStorage address required');
    }
    if(!options.Token.address) {
      throw Error('CampShareManager deploy. Token address required');
    }
    await setupContract(options, 'CampShareManager', deployCampShareManager(options));
  }

  if(options.Moderator.deploy) {
    if(!options.CampShareManager.address) {
      throw Error('Moderator deploy. CampshareManager address required');
    }
    await setupContract(options, 'Moderator', deployModerator(options.CampShareManager));
  }

  if(options.PLGProject.deploy) {
    // Deploy dummy project for clone proxy
    const dummyProject = await deployDummyProject();
    // Deploy clone factory
    await setupContract(options, 'PLGProjectFactory', deployProjectFactory(dummyProject.address));
    // Deploy real project
    await setupContract(options, 'PLGProject', deployProject(options));
  }

  return options;
};

module.exports = {
  defaultOptions,
  deployAccountManager,
  deployAccountStorage,
  deployAdministrator,
  deployCampShareManager,
  deployCampShareStorage,
  deployModerator,
  deployProject,
  deployToken,
  testingDeploy,
  setupContract,
};
