# insta-winner

Randomly select winners of a giveaway from the comments matching a regex.

## Build

```
npm install
npm run compile
```

## General usage

```
node bin/main.js <url> <numWinners> <regex>
```

## Example
The following selects one winner that has tagged two friends:

```
node bin/main.js "https://www.instagram.com/p/BnY_L4IAI_1/?taken-by=pauls_3d_things" 1 ".*@.+@.+"
```