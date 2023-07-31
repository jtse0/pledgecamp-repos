  // SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "./CloneFactory.sol";
import "./PLGProject.sol";

contract PLGProjectFactory is CloneFactory {

    /// @dev Mapping of project IDs to PLGProjects
    mapping(uint256 => PLGProject) public projectChildren;

    /// Master project contract address
    address public projectMaster;

    /// @notice Broadcasts address of newly created project child contract
    event ProjectCreated(address newProjectAddress, address masterProjectAddress);

    /// @notice Constructor used to set master project contract address
    /// @param masterContract Address of master project contract
    constructor(address masterContract) {
        require(masterContract != address(0), "Zero address");
        projectMaster = masterContract;
    }

    /// @notice Creates a child project contract and initializes it based on parameters
    /// @param projectId ID of project
    /// @param token ERC20 token used for backing the project
    /// @param administrator Recovers funds if something goes wrong/ receives listing fee
    /// @param accountStorage Managed account address for handling transfers
    /// @param fundingWallet The address of external source of funds
    /// @param creator The project creator
    /// @param recipient The recipient of project funds. If a managed account created project recipient must be AccountStorage
    /// @param milestoneTimes Array of milestone timestamps
    /// @param releasePercents Array of milestone release percentages
    /// @return Address of the new child PLGProject
    function createChild(
        uint256 projectId,
        address token,
        address administrator,
        address accountStorage,
        address fundingWallet,
        address creator,
        address recipient,
        uint256[] memory milestoneTimes,
        uint256[] memory releasePercents
    ) external returns(address) {
        require(projectId > 0, "Invalid project ID");
        require(address(projectChildren[projectId]) == address(0), "Project ID not available");
        PLGProject child = PLGProject(createClone(projectMaster));
        projectChildren[projectId] = child;
        child.init(token, administrator, accountStorage, fundingWallet, creator, recipient, milestoneTimes, releasePercents);
        emit ProjectCreated(address(child), projectMaster);
        return address(child);
    }

    /// @notice Get child address based on its project ID
    /// @param projectId ID of a project
    /// @return Adress of child project
    function getChildAddress(uint256 projectId) external view returns(address) {
        require(projectId > 0, "Invalid project ID");
        return address(projectChildren[projectId]);
    }

    /// @notice Check if address represents a child project
    /// @param childAddress The address to check
    /// @return True if input address is a child contract of PLGProject
    function isChild(address childAddress) external view returns(bool) {
        require(childAddress != address(0), "Zero addr");
        return isClone(projectMaster, childAddress);
    }
}
