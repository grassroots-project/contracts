// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {ERC20} from "@rari-capital/solmate/src/tokens/ERC20.sol";

contract GPT is ERC20 {
    constructor() ERC20("Grassroots Project Token", "GPT", 18) {}
}