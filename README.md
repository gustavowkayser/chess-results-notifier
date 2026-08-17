# About the Project

Chess Results Notifier is a simple mobile app for Android that notifies users about the matchmaking of a chess
tournament. This is intended for chess players that want to keep track of the game.

## Functionalities

The user can register a chess-results link for the tournament he wants to keep track of. He can choose two types of
notifications:

- Round pairing
- Round pairing with player tracking

## Chess Results Scraping

**Base URL**: ```https://sx.chess-results.com/tournament_id```

For the scraping, we need to specify the server (e.g. ```https://s1...```, ```https://s2...``` or ```https://s3...```)
The tournament ID follows a rule. It starts with ```tnr``` and ends with ```.aspx```

With the **Base URL** we can get the tournament details with a simple scraping. Here are the query params that we're
gonna use.

```lan```: It's the query parameter for the language of the page. This is helpful for getting details right.

```art```: I don't know what this actually means. But with this you can control the pairing round category

```rd```: This the round number

## Architecture

For this project it makes sense to go with Event Sourcing since history and auditing could be crucial.
