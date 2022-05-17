// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {ERC20} from "@rari-capital/solmate/src/tokens/ERC20.sol";
import {Controlled} from "./Controlled.sol";

contract GPT is ERC20, Controlled {
    
    constructor() ERC20("Grassroots Project Token", "GPT", 18) {}
    
    function mint(address to, uint256 amount) external onlyController {
        _mint(to, amount);
    }
}