// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./zeppelin/ERC20.sol";
import "./PLGProject.sol";

/// @title A 'bank' that stores PLG on behalf of users managed by AccountManager
contract AccountStorage is Ownable {

    /// @dev Mapping of user account IDs to PLG
    mapping(uint256 => uint256) private accounts;

    /// @dev Total managed PLG
    uint256 public totalPLG;

    /// @dev PLG token contract
    ERC20 public token;

    /// @dev AccountManager contract
    address public accountManager;

    /// @param erc20Token The address of the PLG token contract
    constructor(address erc20Token) {
        token = ERC20(erc20Token);
    }

    /// @dev Throws if called by any account other than the owner OR accountManager
    modifier onlyOwnerOrManager() {
        require(msg.sender == owner || msg.sender == accountManager, "Unauthorized access");
        _;
    }

    /// @notice Set the AccountManager Connection
    /// @param newAccountManager AccountManager address
    function setAccountManager(address newAccountManager) external onlyOwner {
        require(newAccountManager != address(0), "Zero addr");
        accountManager = newAccountManager;
    }

    /// @notice Get the balance of a user account
    /// @param account The account ID
    function balanceOf(uint256 account) external view returns(uint256) {
        require(account != 0, "Invalid account value");
        return accounts[account];
    }

    /// @notice Increase the PLG balance of a user account
    /// @notice There should be a corresponding call to decreaseBalance.
    /// @notice Or, this contract should receive PLG from an external eth account
    /// @param account The user account to credit with PLG
    /// @param amount The amount of PLG to add
    function increaseBalance(uint256 account, uint256 amount) public onlyOwnerOrManager {
        require(account != 0, "Invalid account value");
        require(amount > 0, "Invalid amount");
        require((totalPLG + amount) <= token.balanceOf(address(this)), "Insufficient balance");
        accounts[account] += amount;
        totalPLG += amount;
    }

    /// @notice Decrease the PLG balance of a user account
    /// @notice There should be a corresponding call to increaseBalance.
    /// @notice Or, this contract should send PLG to an external eth account
    /// @param account The user account to debit PLG from
    /// @param amount The amount of PLG to remove
    function decreaseBalance(uint256 account, uint256 amount) public onlyOwnerOrManager returns(bool) {
        require(account != 0, "Invalid account value");
        require(amount > 0, "Invalid amount");
        if(accounts[account] >= amount && totalPLG >= amount) {
            accounts[account] -= amount;
            totalPLG -= amount;
            return true;
        }
        return false;
    }

    /// @notice Transfer PLG between two user accounts
    /// @param sender The user accound to debit PLG from
    /// @param receiver The user account to credit PLG to
    /// @param amount The amount of PLG to transfer
    function transferInternal(uint256 sender, uint256 receiver, uint256 amount) external onlyOwnerOrManager {
        require(sender != 0, "Invalid account value");
        require(receiver != 0, "Invalid account value");
        require(amount > 0, "Invalid amount");
        require(decreaseBalance(sender, amount), "Failed transfer");
        increaseBalance(receiver, amount);
    }

    /// @notice Transfer PLG from a user account to an Ethereum account
    /// @param sender The user accound to debit PLG from
    /// @param receiver The Ethereum account to credit PLG to
    /// @param amount The amount of PLG to transfer
    function sendExternal(uint256 sender, address receiver, uint256 amount) external onlyOwnerOrManager {
        require(sender != 0, "Invalid account value");
        require(receiver != address(0), "Zero addr");
        require(amount > 0, "Invalid amount");
        require(decreaseBalance(sender, amount), "Failed transfer");
        token.transfer(receiver, amount);
    }

    /// @notice Allows AccountStorage to delegate the use of a managed accounts funds by some other address
    /// @param account The user account to debit PLG from
    /// @param receiver The Ethereum account that now has control over the funds
    /// @param amount The amount of PLG to allow transfer of
    function allowExternal(uint256 account, address receiver, uint256 amount) external onlyOwnerOrManager {
        require(account != 0, "Invalid account value");
        require(receiver != address(0), "Zero addr");
        require(amount > 0, "Invalid amount");
        require(decreaseBalance(account, amount), "Failed transfer");
        require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
        token.increaseAllowance(receiver, amount);
    }

    /// @notice Wrapper for receiving tokens from an Ethereum account via the ERC20 approval mechanism
    /// @notice All approved PLG will be transferred
    /// @param sender An Ethereum address that has approved PLG for transfer to this contract
    /// @param receiver The user account that should receive the PLG
    function receiveExternal(address sender, uint256 receiver) external {
        require(sender != address(0), "Zero addr");
        require(receiver != 0, "Invalid account value");
        uint256 allowance = token.allowance(sender, address(this));
        if(token.transferFrom(sender, address(this), allowance)) {
            increaseBalance(receiver, allowance);
        }
    }

    /// @notice Getter for AccountManager Contract Address
    function getAccountManagerAddress() external view returns(address) {
        return accountManager;
    }

    /// @notice Returns the accountID of an addresses
    /// @param beneficiary Address of user
    /// @return AccountID of user
    function getID(address beneficiary) external pure returns(uint256){
        return uint256(uint160(beneficiary));
    }
}
