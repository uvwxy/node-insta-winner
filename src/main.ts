
import fetch, { Response } from "node-fetch";

const START_TOKEN = "window._sharedData = {";
const END_TOKEN = "</script>";
interface SimpleComment {
    node: {
        text: string;
        owner: {
            username: string
        };
    };
};

const params = process.argv;
console.log(params);

// node main.js <param> <param> <param>
if (params.length < 5) {
    console.log("Usage: node main.js <url> <numWinners> <regex>");

} else {
    const url = params[2];
    const numWinners = parseInt(params[3]);
    const regex = params[4];




    fetch(url)
        .then((resp: Response) => resp.text())
        .then((text: string) => {
            const startPosition = text.indexOf(START_TOKEN);
            const endPosition = text.indexOf(END_TOKEN, startPosition);
            const data = text.substr(startPosition + START_TOKEN.length - 1, endPosition - startPosition - START_TOKEN.length);

            const comments = JSON.parse(data).entry_data.PostPage[0].graphql.shortcode_media.edge_media_to_comment.edges as SimpleComment[];

            // TODO: make this a cli prop as regex
            const validComments = comments.filter((c: SimpleComment) => c.node.text.match(regex))

            // create a map so no multi submissions win more ;)
            const commentsMap: { [index: string]: string } = {};

            validComments.forEach((c: SimpleComment) => {
                commentsMap[c.node.owner.username] = c.node.text;
            })

            const names = Object.keys(commentsMap);
            const winners: string[] = [];
            for (let i = 0; i < numWinners; i++) {
                const len = names.length - 1;

                // round to the nearest number
                const randomIndex = Math.round(Math.random() * len)
                winners.push(names[randomIndex]);
                names.splice(randomIndex, 1);
            }

            console.log("The winners are:", winners);
        });

}