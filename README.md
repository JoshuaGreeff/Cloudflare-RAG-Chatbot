API Documentation

### HTML Serving Endpoints:

1. **GET /talk**
   - **Description**: Serves the "talk.html" file to the client.
   - **Usage Example**: Open your browser and go to `https://yourdomain/talk` to view the content of the "talk.html" file.

2. **GET /notes**
   - **Description**: Serves the "notes.html" file to the client.
   - **Usage Example**: Open your browser and go to `https://yourdomain/notes` to view the content of the "notes.html" file.

### Notes Serving and Management Endpoints:

1. **GET /notes.json**
   - **Description**: Returns all notes from the database in JSON format.
   - **Usage Example**: Send a GET request to `https://yourdomain/notes.json` to retrieve all notes as a JSON response.

2. **POST /notes**
   - **Description**: Creates a new note with the provided text. The request body must contain a JSON object with a `text` field.
   - **Usage Example**: 
     ```
     POST https://yourdomain/notes
     Body:
     {
         "text": "This is a new note."
     }
     ```
   - **Response**: Returns a status message, "Created note", on successful creation.

3. **DELETE /notes/:id**
   - **Description**: Deletes a note by its ID. The ID is passed as a URL parameter.
   - **Usage Example**: 
     ```
     DELETE https://yourdomain/notes/1234
     ```
     - This will delete the note with ID `1234`.

### Chat and AI Interaction Endpoints:

1. **POST /**
   - **Description**: Accepts a POST request with a `messages` and `query` in the JSON body and returns a response from the AI model. The AI model uses context from previous notes to generate the response.
   - **Usage Example**:
     ```
     POST https://yourdomain/
     Body:
     {
         "messages": [{"role": "user", "content": "What is the weather like?"}],
         "query": "What is the capital of France?"
     }
     ```
   - **Response**: Returns a JSON object containing the conversation messages along with the AI's response.

### Notes Workflow and Database Interaction:

1. **POST /notes (Internal Usage)**
   - **Description**: This internal endpoint triggers a workflow to create a new note in the database and generate its vector embedding. It is used by the `RAGWorkflow` class to create records and vectorize the data.
   - **Usage Example**: This endpoint is not directly exposed to users but is used by the backend to handle note creation and embedding.

### Cloudflare Workflow (RAGWorkflow):

- **Description**: The `RAGWorkflow` class is responsible for managing the workflow of creating a new note, generating its vector embedding using the AI model, and storing the vector in the vector index.
- **Flow**:
   1. The workflow receives a note text.
   2. It creates a new record in the notes table of the database.
   3. It generates an embedding for the note text using the AI model.
   4. The generated embedding is inserted into the vector index for future queries.

### Setup Instructions:

1. **Installation/Setup**:
   - Clone the repository:
     ```
     git clone https://github.com/your-repo-name.git
     cd your-repo-name
     ```
   - Install dependencies:
     ```
     npm install
     ```
   - Create a database and vector index:
     ```
     wrangler d1 create DATABASE
     wrangler vectorize:index create VECTOR_INDEX --preset "@cf/baai/bge-base-en-v1.5"
     ```
   - Apply the database migration:
     ```
     wrangler d1 migrations apply DATABASE
     ```

2. **Configuration**:
   - Add the following to `wrangler.toml`, replacing the placeholders with your values:
     ```
     [[d1_databases]]
     binding = "DATABASE"
     database_name = "<your database name>"
     database_id = "<your database id>"
     
     [[vectorize]]
     binding = "VECTOR_INDEX"
     index_name = "<your vector index name>"
     ```

3. **Deploy the application**:
    - npm run deploy

### Usage:

After deploying, you can use the following routes:

1. **/notes.json**: Fetch all notes in the knowledge base in JSON format.
2. **/notes**: View all notes in the knowledge base via the "notes.html" file.
3. **/talk**: View the "talk.html" file.
4. **POST /notes**: Add a new note to the knowledge base (requires the `text` field in the request body).
5. **DELETE /notes/:id**: Delete a note by its ID.

