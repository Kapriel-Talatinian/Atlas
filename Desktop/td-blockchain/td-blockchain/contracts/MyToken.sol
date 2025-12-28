// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    // Staking
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakeTimestamp;

    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        // initialSupply est en "unités entières"
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // ============= EXOS TP =============

    // 1) checkBalance : lire le solde d'une adresse
    function checkBalance(address account) public view returns (uint256) {
        return balanceOf(account);
    }

    // 2) approveAndCheck : approuver puis retourner l'allowance
    function approveAndCheck(address spender, uint256 amount)
        public
        returns (uint256)
    {
        approve(spender, amount);
        return allowance(msg.sender, spender);
    }

    // 3) burn : détruire des tokens qu'on possède
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    // ============= STAKING SIMPLE =============

    // Le user envoie des tokens au contrat pour les "staker"
    function stake(uint256 amount) public {
        require(amount > 0, "Invalid amount");

        // on envoie les tokens du user vers ce contrat
        _transfer(msg.sender, address(this), amount);

        stakedBalance[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
    }

    // Retirer les tokens + récompense
    function unstake() public {
        uint256 amount = stakedBalance[msg.sender];
        require(amount > 0, "Nothing to unstake");

        uint256 duration = block.timestamp - stakeTimestamp[msg.sender];

        // récompense très simplifiée : proportionnelle au temps
        // (à adapter selon ton TP)
        uint256 reward = (amount * duration) / 100000; 

        stakedBalance[msg.sender] = 0;
        stakeTimestamp[msg.sender] = 0;

        // on crée la récompense
        _mint(msg.sender, reward);

        // on renvoie les tokens stakés
        _transfer(address(this), msg.sender, amount);
    }
}
