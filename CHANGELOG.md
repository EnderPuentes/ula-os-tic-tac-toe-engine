# Changelog

# 1.1.0 (2025-05-02)


### Bug Fixes

* add type annotations for player and room worker variables in server logic ([97192cc](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/97192cc5db0d0ecabd0b8f9c2c5bd5ab0f450130))
* emit player win event and update socket handling for game state in server logic ([b1331d5](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/b1331d514bde272dc390d1d026a2b6d1e18182bd))
* enhance game start handling with error management and update socket emissions in server logic ([5ce7726](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/5ce772683855276105a4750f4f358e8bd773a951))
* enhance room creation logic to include player name and simplify room ID generation in server logic ([fd5db35](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/fd5db355b2d7004389933d261842fa3fd0c5130b))
* implement play again functionality and update game state management in server logic ([e258ae2](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/e258ae234009163f1c3d93a9ed553b227430b4ed))
* improve message processing in room worker to prevent concurrent handling ([4a6bd20](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/4a6bd20ef34c43d0a656a8527c6f80c44513f896))
* refactor message handling to simplify sender assignment and update socket emissions in server logic ([9dd6a6b](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/9dd6a6beaec7483ab5c8e7a20888ca168310c623))
* refactor player typing indicators and streamline message handling in server logic ([7a18602](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/7a186026a365de9961bdf836376a6cc086822891))
* streamline socket emissions for player join and leave events in server logic ([4af0374](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/4af0374e74e1089306e13d521e9d055b0d6b686a))
* update game results structure and player stats management in server logic ([cfe7d87](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/cfe7d8798e299000f63a3a642f5c48c17db5cf67))
* update player avatar URL to use new DiceBear API for improved visuals ([7d82428](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/7d82428cf31d1c7c32975ab37a1d4d88f35ebca7))
* update socket emission for player creation success/error and restructure game state management ([b1ce704](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/b1ce7044cec677845f51741fa4e1ac2ebbdfec23))
* update socket emissions for player join success/error and restructure game state management ([862cad5](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/862cad544c8a76a2d163a4bf683084c0c38a207a))
* update socket emissions for player join success/error in server logic ([6bb0639](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/6bb0639462683d16699d9e25ca4e04354222886c))
* update socket emissions for player leave success/error and improve message handling in server logic ([1d8ed9f](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/1d8ed9fa74458d5e5d51a84a7e0b979348eb4067))
* update socket emissions for player leave success/error and restructure message handling in server logic ([b08f1ea](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/b08f1eaa366e36b93bcdc495131653bfc0c15df2))
* update socket emissions for room creation and restructure game state management in server logic ([434fa56](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/434fa56036b584d560ee84bbcd7976b6e3b589f5))
* update start script in package.json to reference correct server file path ([e2df33a](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/e2df33ab6262f224bb748c8df3f230a7cb6ecf25))


### Features

* add codebase server socket ([6960a53](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/6960a5303d87c7eb4baeeecde07e18ac83a81ab9))
* add game logic to determine winner and winning lines in Tic Tac Toe ([afc9b73](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/afc9b73049065748375cd98ed9e212dc3a8b1d8a))
* add getAvatarUrl function to generate avatar URLs based on player names ([89c4b8d](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/89c4b8d16d6db01a42794daae931083f61ad3cfd))
* add player room validation to prevent joining multiple rooms in server logic ([49ae7ca](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/49ae7caaac87d0a5d2c30151ad12df94abab0cf3))
* add room status and maxPlayers to enhance game state management ([388013f](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/388013f9d04cc37a3a47aec60f5b487ad69ab489))
* enhance Room type with game state management and player results for improved gameplay ([9e13d53](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/9e13d5356371942e7ed466a0853c6a6618a01fa1))
* enhance server functionality with player management and room joining logic ([0f795a5](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/0f795a53e18d7fee3ac4ba12059b6513a6ae29c4))
* enhance server logic with improved player and room management, including error handling and message processing ([079ab13](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/079ab137dbae1f7407a7dd695e38be5193665e8d))
* implement chat functionality with message handling and typing indicators ([1e52335](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/1e52335d960a275c0a2f27d1946ba1157c4718e4))
* implement game start functionality and update room state management in server logic ([c90dcaf](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/c90dcaf5791b2957f35b6e51ee5cc4172710d2ba))
* implement leave player functionality in server logic for improved room management ([5f3976c](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/5f3976c404abe477f32dc42ddaef0ddb5d3c066c))
* implement player move handling and winner determination in server and worker logic ([d941a76](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/d941a7615be841342f84af5dfd8f44defc879e85))
* implement worker threads for room management and enhance player/room handling ([2732db2](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/2732db21dea858895a740f13a878d323fcbd63c7))
* refine message handling and player interactions in server and worker for improved game experience ([ff53e06](https://github.com/EnderPuentes/ula-os-tic-tac-toe-engine/commit/ff53e06f226b89491679442050a6e271d2a86808))
