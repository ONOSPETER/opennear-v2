// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
/// Wrapped NEAR NFTs. Only `minter` (the Chain Signatures derived address) can mint.
/// The current holder burns with redeem(id, nearAccount); the relayer reads redeemedTo(id) and releases the NEAR original to that account.
contract OpenNearWrapper is ERC721URIStorage {
  address public immutable minter;
  mapping(uint256 => string) public redeemedTo;
  event Minted(uint256 indexed id, address indexed to);
  event Redeemed(uint256 indexed id, address indexed holder, string nearAccount);
  constructor(address _minter) ERC721("OpenNear Wrapped NFTs", "ONEAR") { require(_minter != address(0), "zero minter"); minter = _minter; }
  function mint(address to, uint256 id, string calldata uri) external {
    require(msg.sender == minter, "not minter");
    delete redeemedTo[id]; _mint(to, id); _setTokenURI(id, uri); emit Minted(id, to);
  }
  function redeem(uint256 id, string calldata nearAccount) external {
    require(ownerOf(id) == msg.sender, "not owner");
    uint256 n = bytes(nearAccount).length; require(n >= 2 && n <= 64, "bad NEAR account");
    _burn(id); redeemedTo[id] = nearAccount; emit Redeemed(id, msg.sender, nearAccount);
  }
}
