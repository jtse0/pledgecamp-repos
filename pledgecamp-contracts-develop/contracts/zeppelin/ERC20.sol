// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "../Ownable.sol";

/**
 * @dev ERC20 token implementation with extras used in PLGToken deployment
 */
contract ERC20 is Ownable {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    mapping (address => uint256) private balances;

    mapping (address => mapping (address => uint256)) private allowances;

    uint256 public totalSupply;

    string public name;
    string public symbol;

    /// Flag for only allowing a single token initialization
    bool public initialized = false;

    /// Flag for locking normal trading
    bool public locked = true;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The defaut value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor (string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    /// @notice Set initial PLG allocations, which can only happen once
    /// @param addresses Addresses of beneficiaries
    /// @param allocations Amounts to allocate each beneficiary
    function initialize(address[] memory addresses, uint256[] memory allocations) external onlyOwner {
        require(!initialized, "Cannot initialize token twice");
        require(addresses.length == allocations.length, "Ensure arrays are of same length");
        initialized = true;

        for(uint i = 0; i < allocations.length; i += 1) {
            _mint(addresses[i], allocations[i]);
        }
    }

    /// @notice Admin function to lock trading
    function lock() external onlyOwner {
        locked = true;
    }

    /// @notice Admin function to unlock trading
    function unlock() external onlyOwner {
        locked = false;
    }

    /// @dev Modifier to make a function callable only when the contract is not paused.
    modifier whenNotLocked() {
        require(!locked, "Ensure contract not paused");
        _;
    }

    function balanceOf(address account) external view virtual returns (uint256) {
        return balances[account];
    }

    /**
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) external virtual whenNotLocked returns (bool) {
        require(amount > 0, "Enter a positive value");
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view virtual returns (uint256) {
        return allowances[owner][spender];
    }

    /**
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) external whenNotLocked returns (bool) {
        require(amount > 0, "Enter a positive value");
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external virtual whenNotLocked returns (bool) {
        require(amount > 0, "Enter a positive value");
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);

        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) external whenNotLocked returns (bool) {
        require(addedValue > 0, "Nonzero value");
        _approve(msg.sender, spender, allowances[msg.sender][spender] + addedValue);
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external whenNotLocked returns (bool) {
        require(subtractedValue > 0, "Enter a positive value");
        uint256 currentAllowance = allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);

        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint256 senderBalance = balances[sender];
        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
        balances[sender] = senderBalance - amount;
        balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        totalSupply += amount;
        balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

}