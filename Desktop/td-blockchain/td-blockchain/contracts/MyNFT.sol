// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // ⚠️ Important : Ownable(msg.sender) pour OZ 5.x
    constructor()
        ERC721("MyNFT", "MNFT")
        Ownable(msg.sender)
    {
        admin = msg.sender; // le déployeur est admin
    }

    // Mint d’un NFT avec URI, réservé à l’admin
    function mintNFT(address to, string memory tokenURI)
        public
        onlyAdmin
        returns (uint256)
    {
        uint256 newTokenId = _tokenIds;
        _tokenIds++;

        _mint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        return newTokenId;
    }

    // Transfert sécurisé : utilise la nouvelle fonction _isAuthorized d’OZ 5.x
    function safeTransfer(address from, address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);

        require(
            _isAuthorized(owner, msg.sender, tokenId),
            "Not owner nor approved"
        );

        safeTransferFrom(from, to, tokenId);
    }

    // Changer l’admin
    function changeAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        admin = newAdmin;
    }
}
