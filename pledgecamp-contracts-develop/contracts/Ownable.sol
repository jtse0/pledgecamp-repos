// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

/// @title Ownable
/// @dev The Ownable contract has an owner address, and provides basic authorization control
/// functions, this simplifies the implementation of "user permissions".
contract Ownable {
    address owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @dev Set the original `owner` of the contract to the sender account.
    constructor() {
        owner = msg.sender;
    }

    /// @dev Throws if called by any account other than the owner.
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is allowed to call");
        _;
    }

    /// @dev Allows the current owner to transfer control of the contract to a newOwner.
    /// @param newOwner The address to transfer ownership to.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Don't assign ownership to null address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

}
