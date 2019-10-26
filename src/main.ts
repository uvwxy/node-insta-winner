
import fetch, { Response } from "node-fetch";
import fs from "fs";

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

// node main.js <param> <param> <param>
if (params.length < 5) {
    console.log("Usage: node main.js <postId> <numWinners> <regex1> <regex2>");

} else {
    const postId = params[2];
    const numWinners = parseInt(params[3]);
    const regex1 = params[4];
    const regex2 = params[5];

    const getUrlCached = (url: string, cacheFile: string) => {
        if (fs.existsSync(cacheFile)) {
            console.log("using cached file", cacheFile);
            return Promise.resolve(fs.readFileSync(cacheFile, { encoding: "UTF-8" }));
        } else {
            return fetch(url)
                .then((resp: Response) => resp.text())
                .then(text => {
                    fs.writeFileSync(cacheFile, text, { encoding: "UTF-8" });
                    return text;
                })
        }
    }

    const getPostPage = (id: string) => {
        const filePath = "./" + id + ".html";
        const postUrl = "https://www.instagram.com/p/" + id + "/";

        return getUrlCached(postUrl, filePath);
    };

    const getQueryId = (id: string) => {
        return getPostPage(id)
            .then(someUglyHtml => {
                // cheap parsing
                const ppcLine = someUglyHtml.split('"').find(line => line.indexOf("PostPageContainer.js") >= 0);

                const urlPostPageContainerJs = "https://www.instagram.com" + ppcLine;
                const ppcCacheFile = "./" + id + "-PostPageContainer.js";
                return getUrlCached(urlPostPageContainerJs, ppcCacheFile)
                    .then(someUglyJavaScript => {
                        // cheap parsing
                        const queryIdLine = someUglyJavaScript.split('\n').find(line => line.indexOf("queryId") >= 0);

                        if (queryIdLine) {
                            let segment = queryIdLine.split(',').find(line => line.indexOf("queryId") >= 0);
                            if (segment) {
                                segment = segment.trim();
                                const offset = "queryId:\"".length;
                                const queryId = segment.substr(offset, segment.length - offset - 1);
                                console.log("Got queryId:", queryId);
                                return queryId;
                            }
                        }
                        throw new Error("Error: could not find queryId in PostPageContainer.js");
                    });
            });
    };

    const fetchAllComents = (shortcode: string, queryId: string, end_cursor: string, commentsStore: SimpleComment[], totalComments: number, done: () => void) => {
        const variables = {
            shortcode,
            first: 13,
            after: end_cursor
        };

        const variablesJson = JSON.stringify(variables);

        const queryUrl = "https://www.instagram.com/graphql/query/?query_hash=" + queryId + "&variables=" + variablesJson;
        fetch(queryUrl)
            .then(resp => {
                if (resp.ok) {
                    resp.json()
                        .then(json => {
                            if (json.status === "ok") {
                                const comments = json.data.shortcode_media.edge_media_to_comment.edges as SimpleComment[];
                                comments.forEach(comment => commentsStore.push(comment));
                                console.log("Got " + commentsStore.length + " of " + totalComments + " comments, fetching more ...");
                                const numComments = json.data.shortcode_media.edge_media_to_comment.count;
                                const hasNextPage = json.data.shortcode_media.edge_media_to_comment.page_info.has_next_page;
                                const endCursor = json.data.shortcode_media.edge_media_to_comment.page_info.end_cursor;
                                if (hasNextPage) {
                                    setTimeout(() => fetchAllComents(shortcode, queryId, endCursor, commentsStore, totalComments, done), 1000);
                                } else {
                                    if (done) {
                                        done();
                                        // fs.writeFileSync("./comments.json", JSON.stringify(commentsStore));
                                    }
                                }
                            }
                        });
                } else {
                    console.log(resp);
                    throw new Error("Error fetching comments");
                }
            });
    };

    const evalComments = (comments: SimpleComment[]) => {


        const validComments = comments.filter((c: SimpleComment) => c.node.text.toLowerCase().match(regex1)
            && c.node.text.toLowerCase().match(regex2));
        console.log("Comments matching regex 1+2: ", validComments.length);

        // create a map so no multi submissions win more ;)
        const commentsMap: { [index: string]: string } = {};

        validComments.forEach((c: SimpleComment) => {
            commentsMap[c.node.owner.username] = c.node.text;
        })

        const names = Object.keys(commentsMap);
        console.log("Number of unique participants: ", names.length);

        const testRolls = [];
        for (let i = 0; i < 20; i++) {
            testRolls.push(Math.floor(Math.random() * names.length));
        }
        console.log("Warming up the dice: " + testRolls.join(", "));

        setTimeout(() => {

            const winners: string[] = [];
            for (let i = 0; i < numWinners; i++) {
                const len = names.length - 1;

                // Math.random is between 0 and 1;
                // we multiply with len, and get a number between 0 and len
                // we round to lower so each bucket of [n.0 - (n+1).0) is assigned to n
                const randomIndex = Math.floor(Math.random() * len)
                console.log("Rolling the dice (0-" + len + "): " + randomIndex);
                winners.push(names[randomIndex]);
                // remove winner. you only win once.
                names.splice(randomIndex, 1);
            }

            console.log(numWinners == 1 ? "The winner is:" : "The winners are:");
            setTimeout(() => {
                winners.forEach(winner => console.log("  @" + winner));
            }, 2000);

        }, 2000);
    };

    // first, check we can find a queryId
    getQueryId(postId)
        .then(queryId => {
            // then parse first chunk of comments
            getPostPage(postId)
                .then(text => {

                    const startPosition = text.indexOf(START_TOKEN);
                    const endPosition = text.indexOf(END_TOKEN, startPosition);
                    const data = text.substr(startPosition + START_TOKEN.length - 1, endPosition - startPosition - START_TOKEN.length);
                    // fs.writeFileSync("./data.json", data);

                    // this some snafu stuff below
                    const postPageData = JSON.parse(data).entry_data.PostPage[0];
                    const caption = postPageData.graphql.shortcode_media.edge_media_to_caption.edges[0].node.text;
                    const numComments = postPageData.graphql.shortcode_media.edge_media_to_parent_comment.count;
                    const hasNextPage = postPageData.graphql.shortcode_media.edge_media_to_parent_comment.page_info.has_next_page;
                    const endCursor = postPageData.graphql.shortcode_media.edge_media_to_parent_comment.page_info.end_cursor;

                    if (numComments) {
                        const comments = postPageData.graphql.shortcode_media.edge_media_to_parent_comment.edges as SimpleComment[];

                        const printInfo = () => {
                            console.log("Caption:", caption)
                            console.log("Total comments:", numComments);
                            console.log(comments);
                        };

                        if (hasNextPage) {
                            fetchAllComents(postId, queryId, endCursor, comments, numComments, () => evalComments(comments));
                        }

                    }
                });
        });


    //         // fetch()
    //         //     .then(resp => resp.ok ? resp.text() : "err")
    //         //     .then(console.log);


    // getPostPage(postId)
    //     .then((text: string) => {

    //         console.log(text.length);

    //         const queryParams = {
    //             shortcode: "B3-IcuPI_2Q",
    //             child_comment_count: 0,
    //             fetch_comment_count: 500,
    //             parent_comment_count: 0,
    //             has_threaded_comments: true
    //         };

    //         const queryParams2 = {
    //             shortcode: "B3-IcuPI_2Q",
    //             child_comment_count: 3,
    //             fetch_comment_count: 40,
    //             parent_comment_count: 24,
    //             has_threaded_comments: true
    //         };
    //         const queryParamsJson = JSON.stringify(queryParams2);
    //         const query_hash = "870ea3e846839a3b6a8cd9cd7e42290c"; // hash.sha256().update(queryParamsJson).digest('hex');


    //         // fetch("https://www.instagram.com/graphql/query/?query_hash=" + query_hash + "&variables=" + encodeURI(queryParamsJson))
    //         //     .then(resp => resp.ok ? resp.text() : "err")
    //         //     .then(console.log);

    //         return;

    //     });

}