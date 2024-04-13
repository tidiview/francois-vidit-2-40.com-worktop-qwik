/* import { HS256 } from 'worktop/jwt'; */
import * as CORS from 'worktop/cors';
import * as utils from 'worktop/utils';
import { reply } from 'worktop/response';
import { Router, compose } from 'worktop';

import { start } from 'worktop/cfw';
import * as Cache from 'worktop/cfw.cache';
import { list, read, write } from 'worktop/cfw.kv';

import type { Context } from 'worktop';
/* import type { ULID, UID } from 'worktop/utils'; */
import type { KV } from 'worktop/cfw.kv';

interface Custom extends Context {
	timestamp: number;
	bindings: {
		JWT_KEY: string;
		JWT_ISS: string;
		/* ACCOUNT: KV.Namespace; */
		NAMESPACE: KV.Namespace;
	};
}

interface DocCommonFrontmatter {
	uid: string;
	commonFrontmatter: CommonFrontmatter;
	// ...
}

interface DocLangFrontmatter {
	uid: string;
	lang: Lang | string;
	frontmatter: Frontmatter;
	// articleBody: string;
	// ...
}

interface DocArticleBody {
	uid: string;
	lang: Lang | string;
	page: number | string | null;
	articleBody: ArticleBody;
	// ...
}

type Lang = "fr" | "ja" | "en";

type CommonFrontmatter = {
	"created": string;
	"date": string;
	"modified": string;
	"totalPageNumber": number | null;
	"itemPage": string;
	"metadata": object;
	"sitemap": object
};

type Frontmatter = {
	"title": string | null;
	"titleone": string;
	"menu": string;
	"created": string;
	"date": string;
	"modified": string;
	"metadata": FrontmatterMetadata;
	"significantLinks": [string],
	"specialty": [string]
};

type ArticleBody = string;

type FrontmatterMetadata = {
	"description": string;
	"keywords": string;
	"imageTitle": string;
	"imageLegend": string;
}

type Doc = DocCommonFrontmatter & DocLangFrontmatter & DocArticleBody;

//interface Doc extends DocCommonFrontmatter, DocLangFrontmatter{}

/* interface Account {
	uid: ULID;
	name: string;
	email: string;
	// ...
} */

/* type TokenPayload = Pick<Account, 'uid' | 'email'>; */

// Create new Router
const API = new Router<Custom>();

API.prepare = compose(
	// Attach global middleware
	(req, context) => {
		context.timestamp = Date.now();

		context.defer(res => {
			let ms = Date.now() - context.timestamp;
			res.headers.set('x-response-time', ms);
		});
	},

	// Attach `Cache` lookup -> save
	Cache.sync(),

	// Attach global CORS config
	CORS.preflight({
		maxage: 3600 * 6, // 6 hr
		credentials: true,
	})
);

API.add('GET', '/', async (req, context) => {
	return reply(200, 'OK', { 'Accept': 'application/json' });
});

API.add('PUT', '/docs/:uid', async (req, context) => {
	try {
		const { uid } = context.params
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct "Accept" header value: "application/json"')
		let data = await utils.body<DocCommonFrontmatter>(req)
		if (!data) return reply(400, 'missing data') 
		data.uid = uid
		const created = data.commonFrontmatter.created
		const date = data.commonFrontmatter.date
		const modified = data.commonFrontmatter.modified
		const totalPageNumber = data.commonFrontmatter.totalPageNumber
		// await NAMESPACE.put(key, value, { metadata: { someMetadataKey: "someMetadataValue" },  });
		await context.bindings.NAMESPACE.put(`doc_${uid}`, JSON.stringify(data), { metadata: { uid: uid, lang: 'all', created: created, date: date, modified: modified, totalPageNumber: totalPageNumber },  })
		let docs: Object = await context.bindings.NAMESPACE.list({prefix: 'doc_'})
		return reply(200, docs)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});

//?page=2
API.add('PUT', '/docs/:lang/:uid', async (req, context) => {
	try {
		const { lang } = context.params
		const { uid } = context.params
		var searchParams = new URLSearchParams(context.url.searchParams)
		let hasPage: boolean = searchParams.has('page')
		// console.log('hasPage: ', hasPage)
		let page: string | number | null = hasPage ? searchParams.get('page') : 1
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct "Accept" header value: "application/json"')
		let data = await utils.body<Doc>(req)
		if (!data) return reply(400, 'missing data')
		data.lang = lang
		data.uid = uid
		if (hasPage === false) {
			let frontmatter: object | Doc = data.frontmatter
			frontmatter = { frontmatter }
			const title = data.frontmatter.title
			const menu = data.frontmatter.menu
			const created = data.frontmatter.created
			const date = data.frontmatter.date
			const modified = data.frontmatter.modified
			let keywords: string | string[] = data.frontmatter.metadata.keywords
			keywords = keywords.split(', ')
			const description = data.frontmatter.metadata.description
			let specialty: string[] = data.frontmatter.specialty
			// await NAMESPACE.put(key, "", {metadata: { value: value }, });
			await context.bindings.NAMESPACE.put(`doc_${uid}-${lang}-0`, JSON.stringify(frontmatter), {metadata: { uid: uid, lang: lang, title: title, menu: menu, created: created, date: date, modified: modified, keywords: keywords, description: description, specialty: specialty.slice(0, 5) }, })
		}
		if (hasPage === true) {
			let articleBody: string | object | Doc = data.articleBody
			articleBody = { articleBody }
			data.page = page
			await context.bindings.NAMESPACE.put(`doc_${uid}-${lang}-${page}`, JSON.stringify(articleBody), {metadata: { uid: uid, lang: lang, page: page }, })
		}
		let docs: Object = await context.bindings.NAMESPACE.list({prefix: 'doc_'})
		return reply(200, docs)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});

API.add('GET', '/docs/:uid', async (req, context) => {
	try {
		const { uid } = context.params
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct Accept header value: "Accept: application/json"')
		const doc = await context.bindings.NAMESPACE.get<DocCommonFrontmatter>(`doc_${uid}`, { type: 'json' }) // , { type: "text" }
		if (!doc) return reply(404, `ref: doc_${uid} not found`)
		return reply(200, doc)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});

API.add('GET', '/docs/:lang/*/:uid', async (req, context) => {
	try {
		const { lang } = context.params
		const { wild } = context.params
		const { uid } = context.params
		const  wildRawString = wild.toString()
		var searchParams = new URLSearchParams(context.url.searchParams)
		let hasPage = searchParams.has('page') // true
		let page: string | number | null = hasPage ? searchParams.get('page') : 1
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct Accept header value: "Accept: application/json"')

		let docCommonFrontmatterNotFound: string = 'docCommonFrontmatter found', docLangFrontmatterNotFound: string = 'docLangFrontmatter found', docArticleBodyNotFound: string = 'docArticleBody found'
		const docCommonFrontmatter: DocCommonFrontmatter | null = await context.bindings.NAMESPACE.get<DocCommonFrontmatter>(`doc_${uid}`, 'json')
		if (!docCommonFrontmatter) {docCommonFrontmatterNotFound = `docCommonFrontmatter ref: doc_${uid} not found`} 

		const docLangFrontmatter: DocLangFrontmatter | null = await context.bindings.NAMESPACE.get<DocLangFrontmatter>(`doc_${uid}-${lang}-0`, 'json')
		if (!docLangFrontmatter) {docLangFrontmatterNotFound = `docLangFrontmatter ref: doc_${uid}-${lang}-0 not found`}
		
		const docArticleBody: DocArticleBody | null = await context.bindings.NAMESPACE.get<DocArticleBody>(`doc_${uid}-${lang}-${page}`, 'json')
		if (!docArticleBody) {docArticleBodyNotFound = `docArticleBody ref: doc_${uid}-${lang}-${page} not found`}

		if ( !docCommonFrontmatter || !docLangFrontmatter || !docArticleBody)
		return reply(404, `${docCommonFrontmatterNotFound}, ${docLangFrontmatterNotFound}, ${docArticleBodyNotFound}, "wild" path: ${wildRawString}`)
		
		let docTotal = Object.assign(docCommonFrontmatter, docLangFrontmatter, docArticleBody)
		return reply(200, docTotal)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});

API.add('POST', '/docs', async (req, context) => {
	try {
	  // Smart `utils.body` helper
	  // ~> parses JSON header as JSON
	  // ~> parses form-like header as FormData, ...etc
	  var input = await utils.body<Doc>(req);
	} catch (err) {
	  return reply(400, 'Error parsing request body');
	}
  
	if (!input || !input.uid) {
	  return reply(422, { title: 'input or uid or page required' });
	}
  
	const value1: DocCommonFrontmatter | undefined = {
	  uid: input.uid,
	  commonFrontmatter: input.commonFrontmatter
	  // ...
	};

	const value2: DocLangFrontmatter | undefined = {
		uid: input.uid,
		lang: input.lang,
		frontmatter: input.frontmatter
		// ...
	  };

	const value3: DocArticleBody | undefined = {
		uid: input.uid,
		lang: input.lang,
		page: input.page,
		articleBody: input.articleBody
		// ...
	};
  
	let success1: DocCommonFrontmatter | boolean = false, success2: DocLangFrontmatter | boolean = false, success3: DocArticleBody | boolean = false;
	let success1Message: string = 'commonFrontmatter not created', success2Message: string = 'docLangFrontmatter not created', success3Message: string = 'docArticleBody not created';
	// Assumes JSON (can override)
	if (typeof value1.commonFrontmatter !== 'undefined') {
		success1 = await write<DocCommonFrontmatter>(context.bindings.NAMESPACE, `doc_${value1.uid}`, value1, { metadata: { uid: input.uid, lang: 'all', created: input.commonFrontmatter.created, date: input.commonFrontmatter.date, modified: input.commonFrontmatter.modified, totalPageNumber: input.commonFrontmatter.totalPageNumber }, })
		success1Message = `doc_${value1.uid} created`
	}
	if (typeof value2.frontmatter !== 'undefined') {
		success2 = await write<DocLangFrontmatter>(context.bindings.NAMESPACE, `doc_${value2.uid}-${value2.lang}-0`, value2, {metadata: { uid: input.uid, lang: input.lang, title: input.frontmatter.title, menu: input.frontmatter.menu, created: input.frontmatter.created, date: input.frontmatter.date, modified: input.frontmatter.modified, keywords: input.frontmatter.metadata.keywords, description: input.frontmatter.metadata.description, specialty: input.frontmatter.specialty.slice(0, 5) }, })
		success2Message = `doc_${value2.uid}-${value2.lang}-0 created`
	}
	if (typeof value3.articleBody !== 'undefined') {
		success3 = await write<DocArticleBody>(context.bindings.NAMESPACE, `doc_${value3.uid}-${value3.lang}-${value3.page}`, value3, {metadata: { uid: input.uid, lang: input.lang, page: input.page }, })
		success3Message = `doc_${value3.uid}-${value3.lang}-${value3.page} created`
	}

	// NAMESPACE.list({prefix?: string, limit?: number, cursor?: string})
	let docs: object = await context.bindings.NAMESPACE.list({prefix: `doc_${value1.uid}`})
  
	// Alias for `event.waitUntil`
	// ~> queues background task (does NOT delay response)
	/* context.waitUntil(
	  fetch('https://localhost:8787/docs/logs', {
		method: 'POST',
		headers: { 'content-type': 'application/json '},
		body: JSON.stringify({ success, value })
	  })
	); */
  
	if ( success1 !== false || success2 !== false || success3 !== false ) { console.log(`${success1Message}, ${success2Message} & ${success3Message}`); return reply(201, docs) }
	return reply(500, 'Error creating record');
  });

API.add('DELETE', '/docs/:uid', async (req, context) => {
	try {
		const { uid } = context.params
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct Accept header value: "Accept: application/json"')
		await context.bindings.NAMESPACE.delete(`doc_${uid}`)
		return reply(200, `deleted doc_${uid}`)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});

API.add('DELETE', '/docs/:lang/*/:uid', async (req, context) => {
	try {
		const { uid } = context.params
		const { wild } = context.params
		const { lang } = context.params
		const  wildRawString = wild.toString()
		var searchParams = new URLSearchParams(context.url.searchParams)
		const hasPage = searchParams.has('page');
		const page: string | number | null = hasPage ? searchParams.get('page') : 0
		const getJsonHeader = req.headers.get('Accept')
		const hasCorrectJsonHeader = getJsonHeader === 'application/json' ? true : false
		if (!hasCorrectJsonHeader) return reply(400, 'missing correct Accept header value: "Accept: application/json"')
		await context.bindings.NAMESPACE.delete(`doc_${uid}-${lang}-${page}`);
		return reply(200, `deleted doc_${uid}-${lang}-${page}, "wild" path: ${wildRawString}`)
	} catch (error) {
		console.error(error)
		return reply(500)
	}
});
  
/* API.add('GET', '/accounts/:uid', async (req, context) => {
	try {
		let item = await read<Account>(context.bindings.ACCOUNT, context.params.uid);
		if (!item) return reply(404, 'Unknown account identifier');
		return reply(200, item, {
			'Cache-Control': 'public,max-age=900'
		});
	} catch (err) {
		return reply(500, 'Error retrieving account');
	}
}); */

/* API.add('POST', '/accounts', async (req, context) => {
	try {
		var input = await utils.body<Account>(req);
		if (input == null) return reply(400, 'Missing request body');
	} catch (err) {
		return reply(500, 'Error parsing request');
	}

	try {
		var values: Account = {
			uid: utils.ulid(),
			name: input.name || '',
			email: input.email || '',
		};

		let isOK = await write<Account>(context.bindings.ACCOUNT, values.uid, values);
		if (!isOK) return reply(400, 'Error saving account');
	} catch (err) {
		return reply(500, 'Error creating account');
	}

	try {
		let JWT = HS256<TokenPayload>({
			key: context.bindings.JWT_KEY,
			iss: context.bindings.JWT_ISS,
			expires: 3600 * 3, // 3 hours
		});

		let token = await JWT.sign({
			uid: values.uid,
			email: values.email,
		});

		return reply(201, { token, values }, {
			Location: `https://${context.url.hostname}/accounts/${values.uid}`
		});
	} catch (err) {
		await context.bindings.ACCOUNT.delete(values.uid);
		return reply(500, 'Error signing token');
	}
}); */

// Initialize: Module Worker
export default start(API.run);
