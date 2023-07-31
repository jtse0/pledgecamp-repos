
## System Overview
The Pledgecamp smart contract ecosystem serves a few purposes:
- Enable trading of Pledge Coin (PLG), the main unit of exchange on Pledgecamp
- Enforce holding of, and voting on, backer insurance for projects
- Implement decentralized moderation of projects that have been flagged for review
- Allow staking of PLG in the form of Camp Shares
- Simplify access to the Pledgecamp features with an on-chain managed account system

Pledge Coin is a custom ERC20 implementation with trade locking and token burning capabilities. It was developed and audited in 2018 along with a basic crowdsale contract, located [here](https://github.com/pledgecamp/pledgecamp-ico-public). Pledge Coin was initially released in February 2019 with a total supply of 1 trillion, and reissued in May 2019 with a total supply of 10 billion.

## Contract Overview

### ERC20
An [ERC20 token](https://en.bitcoinwiki.org/wiki/ERC20) with ticker symbol "PLG" used to back projects. This token is an exact copy of the version used in the public crowdsale and the future platform.

### PLGProject
A Pledgecamp project starts out as a listing on pledgecamp.com, where backers can contribute funds to receive future rewards. If a project's funding goal is met within the designated time period, a percentage of the money is automatically paid out to the creator. The remainder of funds are converted to Pledgecamp and sent to a new instance of the PLGProject contract. The amount initially withheld depends on a variable "listing fee" determined by the creator before publishing the project. Below is an example of what the fee structure might look like:

Listing Fee | Funds Withheld |
-------------|---------------- |
1% | 50% |
2% | 40% |
3% | 30% |
4% | 20% |
4.5% | 10% |
5% | 0% |

These numbers are subject to change at any time. The listing fee is dispersed among Camp Share holders (moderators), which you can read more about below.

The PLGProject contract tracks project milestones and backer insurance votes. The creator may withdraw funds after a milestone date passes, as long as the weighted sum of insurance votes does not exceed 50%. If the votes do exceed 50%, backers who voted to receive refunds can withdraw a part of their original investment proportional to the amount of funds still withheld in the contract. The rest of the tokens are available to the creator, so they can attempt to complete the project with less money and fewer obligations to backers.

The contract is initialized with the following project information:

Parameter | Description |
----------|------------- |
tokenAddress | The Ethereum address of the Pledge Coin contract, used for checking balances and making token transactions |
administratorAddress | The Ethereum address of the administrator contract, which receives the listing fee and recovers funds if something goes wrong (e.g. the creator loses control of their wallet). |
accountStorageAddress | The Ethereum address of the account storage contract, used for holding and transferring funds on behalf of both the creator and backers |
creatorAddress | The Ethereum address of the project creator |
milestoneTimes | A list of milestone timestamps |
releasePercents | A list of milestone release percentages, matched to `milestoneTimes` |

Once the contract is created, its `setBackers` function is called by the account manager to record project backers, the percentage of each backer's contribution held as insurance, and the total funds received by the project.

After all backers have been recorded in the contract, they may vote to refund at any time by calling `milestoneVote`. Each vote is weighted by the amount of funds contributed by the backer. When each milestone time is reached (determined by `milestoneTimes` during initialization), `checkMilestones` must be called in order to calculate whether refund votes exceed 50%. If they do, the project state is marked as `MilestoneFailed`, backers who voted to cancel may receive their refund by calling `requestRefund`, and the creator receives the remaining tokens by calling `withdrawFunds`. If refund votes are less than 50%, the creator receives a portion of backer insurance according to the milestone's release percentage (provided by `releasePercents` during initialization).

### CampShare
This contract allows participating users to stake PLG, and receive Camp Shares in return at a 1:1 ratio. The contract periodically awards stakers dividends in the form of a percentage of the Pledge Coins collected from project listing fees. The period will tentatively be set to three months, but is subject to change at any time. CS may be converted back to PLG at any time, but dividends will not be awarded for the current period, and the conversion is not finalized until the end of the period. As with all other public facing contract functionality, all Camp Share actions can be done through the managed account system.

A user can convert PLG to CS by using the standard ERC20 function `approve` to allow a transfer to the CampShare contract. The user then calls the CampShare function `acceptPLG`, which records the transfer and notes that the user should receive CS at the start of the next dividend period. During this time, the user may call `refundPLG` to immediately have their PLG returned without waiting until the end of the period.

At the end each period, `receiveDividends` must be called by each CS holder. It is taken care of automatically if CS was purchased via the managed account system. This triggers a dividend payment if the user has held CS for at least one full dividend period.

To convert CS back to PLG, the user must first call `unstakeCS`. At the end of the current dividend period, `withdrawPLG` can be called to finish the conversion.

In order to receive these dividends, Camp Share stakers have an obligation to moderate projects. At any point in time, the platform backend may request a moderation event due to user reported TOS violations. The Camp Share contracts selects seven moderators in order of when they originally staked PLG. The moderators must vote whether or not to de-list a project within a fixed period of time. If they miss two votes (TBD) in one period, they forfeit dividends for that period.

### Account Management
The account management system is split into two contracts. `AccountStorage.sol` is a mapping of user IDs to token values. It only functions to track user account balances, and enable internal and external token transfers. These transfer functions can only accessed by the contract defined in `AccountManager.sol`. The account manager contains functions that execute platform operations on behalf of users, including backer insurance voting, Camp Share staking, and project moderation. Pledge Coins are transferred to or from account storage if necessary for the operation (e.g. receiving backer insurance refunds, or converting PLG to CS). Access to the account manager is controlled by the Pledgecamp backend server, which allows authorized users to interact with the platform contracts via pledgecamp.com

Since the PLGProject contract may be upgraded at any point, separating the token storage from the platform actions is necessary. The storage interface is very simple, so the upgrade process can be done in just a few steps:
- Develop and audit new PLGProject contract
- Upgrade `AccountManager.sol` to match new project functionality
- Publish the contracts
- Register the new manager contract with the existing storage contract

### Administrator
This contract provides various administrative functions necessary for platform operation that don't fit with the other contracts. It maintains a mapping of project contract addresses to listing fees, which allows creators to set up projects with private wallets, instead of the Pledgecamp account management system. This way the backer insurance rules and listing fees are still enforced, which is a requirement for being listed on pledgecamp.com.

The administrator receives listing fees after projects complete successfully, which are distributed to Camp Share holders periodically. This is handled by the `sendDividends` function, which is a wrapper around ERC20 token transfer restricted to only allow access to the Camp Share contract.

Finally, the administrator also allows the Camp Share contract to assign project moderators. It maintains a mapping of moderator addresses for every project that allows the Camp Share contract to quickly determine whether a specific Ethereum address is a moderator. The Camp Share contract may set or clear moderator status through administrator functions.

## Security
TODO - pending discussion
