// https://developers.cloudflare.com/workers-ai/tutorials/build-a-retrieval-augmented-generation-ai/
// https://github.com/kristianfreeman/cloudflare-retrieval-augmented-generation-example/blob/main/src/index.ts

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { methodOverride } from 'hono/method-override'

// @ts-expect-error
import talk from './talk.html'
// @ts-expect-error
import notes from './notes.html'

type Env = {
	AI: Ai;
	DATABASE: D1Database;
	RAG_WORKFLOW: Workflow;
	VECTOR_INDEX: VectorizeIndex
};

type Note = {
	id: string;
	text: string;
}

type Params = {
	text: string;
};

const app = new Hono<{ Bindings: Env }>()
app.use(cors())

app.get('/notes.json', async (c) => {
	const query = `SELECT * FROM notes`
	const { results } = await c.env.DATABASE.prepare(query).all()
	return c.json(results);
})

app.use('/notes/:id', methodOverride({ app }))
app.delete('/notes/:id', async (c) => {
	const { id } = c.req.param();
	const query = `DELETE FROM notes WHERE id = ?`
	await c.env.DATABASE.prepare(query).bind(id).run()
	await c.env.VECTOR_INDEX.deleteByIds([id])
	return c.status(200)
})

app.post('/notes', async (c) => {
	const { text } = await c.req.json();
	if (!text) return c.text("Missing text", 400);
	await c.env.RAG_WORKFLOW.create({ params: { text } })
	return c.text("Created note", 201);
})

app.get('/talk', async (c) => {
	return c.html(talk);
})

app.get('/notes', async (c) => {
	return c.html(notes);
})

app.post('/', async (c) => {
	// Accept the chat messages from the request body
	const { messages, query } = await c.req.json().catch(() => ({ messages: [], query: "Hello" }));

	console.log(messages)

	const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: query })
	const vectors = embeddings.data[0]

	const vectorQuery = await c.env.VECTOR_INDEX.query(vectors, { topK: 5 });

	let notes: string[] = [];

	await Promise.all(vectorQuery.matches.map(async ({ id }) => {
		const query = `SELECT * FROM notes WHERE id = ?`;
		const { results } = await c.env.DATABASE.prepare(query).bind(id).all<Note>();
		if (results) notes.push(...results.map(note => note.text));
	}));

	console.log(notes)

	const contextMessage = notes.length
		? `Context:\n${notes.map(note => `- ${note}`).join("\n")}`
		: ""
	const systemPrompt = `Please respond in a formal and professional tone. Avoid using casual language or informal expressions. Focus on providing clear, accurate, and respectful responses based on the information provided, and do not include irrelevant context. Be concise. Don't answer questions you have not been given. The system will provide you potentially helpful context. do not explicitly refer to the context. Answer questions you do not know the asnwer to with "I don't know" \n`

	const response = await c.env.AI.run(
		"@cf/meta/llama-3.1-8b-instruct",
		{
			messages: [
				{ role: 'system', content: systemPrompt + contextMessage },
				//...(notes.length ? [{ role: 'assistant', content: contextMessage }] : []),
				...messages,  // Include previous chat messages
				{ role: 'user', content: query }
			] as RoleScopedChatInput[]
		}
	) as AiTextGenerationOutput
	// Return the entire chat along with the response
	if (response) {
		return c.json({
			messages: [...messages, { role: 'user', content: query }, { role: 'assistant', content: (response as any).response }], // Add the assistant's response
			response: (response as any).response
		});
	} else {
		return c.json({ response: "We were unable to generate output", }, 500);
	}
})

export class RAGWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const env = this.env
		const { text } = event.payload;

		const record = await step.do('create database record', async () => {
			const query = "INSERT INTO notes (text) VALUES (?) RETURNING *"

			const { results } = await env.DATABASE.prepare(query)
				.bind(text)
				.run<Note>()

			const record = results[0]
			if (!record) throw new Error("Failed to create note")
			return record;
		})

		const embedding = await step.do('generate embedding', async () => {
			const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: text })
			const values = embeddings.data[0]
			if (!values) throw new Error("Failed to generate vector embedding")
			return values
		})

		await step.do('insert vector', async () => {
			return env.VECTOR_INDEX.upsert([
				{
					id: record.id.toString(),
					values: embedding,
					namespace: "testing"
				}
			]);
		})
	}
}

export default app