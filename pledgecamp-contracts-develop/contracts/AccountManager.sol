// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./AccountStorage.sol";
import "./PLGProject.sol";
import "./CampShareManager.sol";

/// @title A wrapper for PLGProject and CampShare that uses PLG from AccountStorage
/// @title A unique uint256 is used to represent each managed user account
contract AccountManager is Ownable {

    /// Contract that holds user PLG
    AccountStorage public accounts;

    /// CampShare Contract
    CampShareManager public campShare;

    /// Administrator Contract
    Administrator public administrator;

    /// @param newAccountStorage The address of a contract that holds user PLG
    constructor(address newAccountStorage) {
        require(newAccountStorage != address(0), "Zero addr");
        accounts = AccountStorage(newAccountStorage);
    }

    /// @notice Set the CampShare Connection
    /// @param newCampShare CampShare address
    function setCampShare(address newCampShare) external onlyOwner {
        require(newCampShare != address(0), "Zero addr");
        campShare = CampShareManager(newCampShare);
    }

    /// @notice Set the Administrator Connection
    /// @param newAdministrator Administrator address
    function setAdministrator(address newAdministrator) external onlyOwner {
        require(newAdministrator != address(0), "Zero addr");
        administrator = Administrator(newAdministrator);
    }

    /// @notice Transfer PLG from a managed account
    /// @param account The managed account to take PLG from
    /// @param receiver The eth account to receive PLG
    /// @param amount The amount of PLG to transfer
    function transferToPrivate(uint256 account, address receiver, uint256 amount) external onlyOwner {
        accounts.sendExternal(account, receiver, amount);
    }

    /// @notice Receive PLG sent to a managed account
    /// @notice `sender` must first approve some PLG for transfer to `accounts`
    /// @notice All approved PLG is transferred
    /// @param sender An eth account that approved some PLG for transfer to accounts`
    /// @param receiver The managed account that will receive the PLG
    function receiveFromPrivate(address sender, uint256 receiver) external onlyOwner {
        accounts.receiveExternal(sender, receiver);
    }

    /// @notice Transfer PLG between two managed accounts
    /// @param sender The managed account to take PLG from
    /// @param receiver The managed account to give PLG to
    /// @param amount The amount of PLG to transfer
    function transferBetweenAccounts(uint256 sender, uint256 receiver, uint256 amount) external onlyOwner {
        accounts.transferInternal(sender, receiver, amount);
    }

    /*
        Functions for administrative interaction of managed accounts:
            - setBackers()
    */
    /// Batch set all the backers and their reserve amounts in a PLG Project
    /// @param projectAddress The address of the PLG Project
    /// @param beneficiaries Array of beneficiaries (as managed account IDs)
    /// @param amounts Array of PLG that each beneficiary will have as reserve
    /// @param funded Set this to true when you have sent in all necessary reserves
    /// @param totalAmount Total amount being sent
    function setBackers(
        address projectAddress,
        uint256[] memory beneficiaries,
        uint256[] memory amounts,
        bool funded,
        uint256 totalAmount
    ) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        PLGProject project = PLGProject(projectAddress);
        project.setBackers(beneficiaries, amounts, funded, totalAmount);
    }

    /*
        Functions for a project created by a managed account:
            - activateProject()
            - withdrawFunds()
            - cancelProject()
    */
    /// Withdraw funds from a project as a project creator
    /// @param projectAddress The address of the PLG Project
    /// @param account The managed account that created the PLG Project
    function withdrawFunds(address projectAddress, uint256 account) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        PLGProject project = PLGProject(projectAddress);
        uint256 amount = project.withdrawFunds();

        accounts.increaseBalance(account, amount);
    }

    /*
        Functions for a managed backers of a project:
            - requestRefund()
            - milestoneVote()
    */
    /// @notice Request or cancel a refund from a project on behalf of a managed account
    /// @param projectAddress The address of a PLG project that `account` has pledged to
    /// @param account The managed account requesting a refund
    function requestRefund(address projectAddress, uint256 account) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        PLGProject project = PLGProject(projectAddress);
        uint256 refunded = project.requestRefund(account);
        require(refunded > 0, "No refunds available");

        accounts.increaseBalance(account, refunded);
    }

    /// @notice Vote on the success or failure of a project creator receiving their next milestone funds
    /// @notice If a vote is true, this means vote is pushing for milestone to not pass
    /// @param projectAddress The address of a PLG project that `account` has pledged to
    /// @param account The managed account submitting a vote
    /// @param vote Whether the backer still supports the project or not
    function milestoneVote(address projectAddress, uint256 account, bool vote) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        require(account != 0, "Invalid account value");
        PLGProject project = PLGProject(projectAddress);
        project.milestoneVote(account, vote);
    }

    /*
        Functions for managed accounts to access CampShare:
            -   stakePLG()
            -   withdrawInterest()
            -   reinvestPLG()
            -   unstakeCS()
    */
    /// @notice Buy CS on behalf of a managed account
    /// @param account The managed account
    /// @param amount The amount of PLG to convert to CS
    function stakePLG(uint256 account, uint256 amount) external onlyOwner {
        accounts.allowExternal(account, address(campShare), amount);

        // Throws on failure
        campShare.stake(account, amount);
    }

    /// @notice Withdraw PLG interest accrued
    /// @param account The managed account
    function withdrawInterest(uint256 account) external onlyOwner {
        // Throws on failure
        uint256 withdrawal = campShare.withdrawInterest(account);
        accounts.increaseBalance(account, withdrawal);
    }

    /// @notice Reinvest and stake PLG interest received
    /// @param account The managed account
    function reinvestPLG(uint256 account) external onlyOwner {
        // Throws on failure
        campShare.reinvest(account);
    }

    /// @notice Unstake CS back to PLG for a managed account
    /// @param account The managed account
    function unstakeCS(uint256 account) external onlyOwner {
        // Throws on failure
        uint256 unstake = campShare.unstake(account);
        accounts.increaseBalance(account, unstake);
    }

    /// @notice Get intrest received in PLG for a managed account CS holder
    /// @param account The managed account
    /// @return Accrued interest in PLG
    function unrealizedGains(uint256 account) external view returns(uint256) {
        return campShare.unrealizedGains(address(accounts), account);
    }

    /// @notice Allows owner to increase the reserve balance of the project contract
    /// @param projectAddress The address of a PLG project that `account` has pledged to
    /// @param amount Amount to add to reserve
    function increaseReserve(address projectAddress, uint256 amount) external onlyOwner {
      require(projectAddress != address(0), "Zero addr");
      PLGProject project = PLGProject(projectAddress);
      project.increaseReserve(amount);
    }

    /// @notice Submit a vote for a project
    /// @param account The managed account
    /// @param project The Address of the project to vote on
    /// @param vote Bytes32 representation of the vote
    function submitVote(uint256 account, address project, bytes32 vote) external onlyOwner {
        // Throws on failure
        campShare.submitVote(account, project, vote);
    }

    /// @notice Get the balance of a user account
    /// @param account The account ID
    /// @return PLG balance
    function balanceOf(uint256 account) external view returns(uint256) {
        uint256 balance = accounts.balanceOf(account);
        return balance;
    }

    /// @notice Allow owner to set the recovery wait period
    /// @param projectAddress The address of a PLG project
    /// @param newRecoveryWaitPeriod Amount to set to new recovery wait period
    function setRecoveryWaitPeriod(address projectAddress, uint256 newRecoveryWaitPeriod) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        PLGProject project = PLGProject(projectAddress);
        // Throws on failure
        project.setRecoveryWaitPeriod(newRecoveryWaitPeriod);
    }
}
