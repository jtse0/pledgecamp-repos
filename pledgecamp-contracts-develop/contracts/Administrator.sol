// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./zeppelin/ERC20.sol";
import "./PLGProject.sol";

contract Administrator is Ownable {

    /// @dev Platform ERC20 token
    ERC20 public token;

    /// Record of project Address -> database information
    mapping(address => Project) public projectMapping;

    /// The CampShare contract
    address public campShare;

    // Project struct
    struct Project {
        // The listing fee attached to a project
        uint256 listingFee;
        // bool Moderator mapping
        mapping(uint256 => bool) moderatorList;
    }

    /// @param newToken Platform ERC20 token
    constructor(address newToken) {
        token = ERC20(newToken);
    }

    /// @notice Set the information of a project: Fee
    /// @param projectAddress The address of the project
    /// @param listingFee The listing fee amount
    function setProjectInfo(address projectAddress, uint256 listingFee) external onlyOwner {
        require(projectAddress != address(0), "Zero addr");
        projectMapping[projectAddress].listingFee = listingFee;
    }

    /// @notice Get the fee of a project
    /// @param project The Address of the project
    /// @return Fee Percent of project
    function getProjectListingFee(address project) external view returns (uint256) {
        return projectMapping[project].listingFee;
    }

    /// @notice Accessor that allows interest funds to be transfered
    /// @param recipient Recipient of the interest
    /// @param amount Amount to be paid
    function sendInterest(address recipient, uint256 amount) external {
        require(msg.sender == campShare, "Unauthorized access");
        require(token.transfer(recipient, amount), "Failed transfer");
    }

    /// @notice set CampShare address
    /// @param newCampShare CampShare contract address
    function setCampShare(address newCampShare) external onlyOwner {
        require(newCampShare != address(0), "Zero addr");
        campShare = newCampShare;
    }

    /// @notice Accessor that allows project moderators to be set
    /// @param project The Address of the project in need of moderation
    /// @param voters Array of voters
    function setProjectModerators(address project, uint256[] memory voters) external {
        require(project != address(0), "Zero addr");
        require(voters.length > 0, "Insufficient array length");
        require(msg.sender == campShare, "Unauthorized access");
        for(uint256 x = 0; x < voters.length; x++) {
            projectMapping[project].moderatorList[voters[x]] = true;
        }
    }

    /// @notice Return the Moderators of a project
    /// @param project The Address of the project
    /// @param id The ID of the moderator
    /// @return true/false if the ID is a moderator
    function checkProjectModerator(address project, uint256 id) external view returns(bool) {
        require(project != address(0), "Zero addr");
        require(id != 0, "Invalid ID value");
        return projectMapping[project].moderatorList[id];
    }

    /// @notice Check whether a voter is an assigned moderator. Only for CampShare to access (changes state)
    /// @param project The Address of the project in need of moderation
    /// @param moderator The moderator that needs checked
    /// @return True if moderator is assigned, otherwise False
    function checkVoter(address project, uint256 moderator) external returns(bool) {
        require(project != address(0), "Zero addr");
        require(moderator != 0, "Invalid account value");
        require(msg.sender == campShare, "Unauthorized access");
        if(projectMapping[project].moderatorList[moderator]) {
            projectMapping[project].moderatorList[moderator] = false;
            return true;
        }
        return false;
    }
}
