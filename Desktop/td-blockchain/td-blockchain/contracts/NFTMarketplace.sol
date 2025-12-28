// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMarketplace is Ownable {
    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;   // en wei
        bool active;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    // commission en basis points : 250 = 2,5%
    uint256 public feeBasisPoints = 250;
    address public feeRecipient;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price
    );

    event Purchased(
        uint256 indexed listingId,
        address indexed buyer
    );

    event ListingCancelled(
        uint256 indexed listingId
    );

    constructor(address _feeRecipient)
        Ownable(msg.sender) // OZ v5 : on passe msg.sender ici
    {
        feeRecipient = _feeRecipient;
    }

    // === METTRE UN NFT EN VENTE ===
    function listNFT(address nft, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be > 0");

        // l'utilisateur doit avoir fait approve() avant
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nft: nft,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit Listed(listingId, msg.sender, nft, tokenId, price);
    }

    // === ACHETER UN NFT ===
    function buyNFT(uint256 listingId) external payable {
        Listing storage lst = listings[listingId];
        require(lst.active, "Not active");
        require(msg.value == lst.price, "Incorrect price");

        lst.active = false;

        // calcul de la commission
        uint256 fee = (msg.value * feeBasisPoints) / 10000;
        uint256 sellerAmount = msg.value - fee;

        // payer le vendeur
        (bool ok1, ) = lst.seller.call{value: sellerAmount}("");
        require(ok1, "Payment failed");

        // payer la commission
        if (fee > 0 && feeRecipient != address(0)) {
            (bool ok2, ) = feeRecipient.call{value: fee}("");
            require(ok2, "Fee payment failed");
        }

        // transférer le NFT à l'acheteur
        IERC721(lst.nft).transferFrom(address(this), msg.sender, lst.tokenId);

        emit Purchased(listingId, msg.sender);
    }

    // === ANNULER UNE ANNONCE ===
    function cancelListing(uint256 listingId) external {
        Listing storage lst = listings[listingId];
        require(lst.active, "Not active");
        require(lst.seller == msg.sender, "Not seller");

        lst.active = false;

        // rendre le NFT au vendeur
        IERC721(lst.nft).transferFrom(address(this), lst.seller, lst.tokenId);

        emit ListingCancelled(listingId);
    }

    // === PARAMÈTRES D'ADMINISTRATION ===

    // changer le taux de commission (max 10%)
    function setFee(uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee too high");
        feeBasisPoints = _feeBasisPoints;
    }

    // changer l'adresse qui reçoit les commissions
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Zero address");
        feeRecipient = _feeRecipient;
    }
}
