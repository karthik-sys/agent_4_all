# Multi-Vendor Agentic Finance Security Platform

A universal security and authorization gateway for AI agent commerce.

## Architecture

- **security-gateway/** - Core security library (protocol-agnostic verification)
- **protocol-adapters/** - Interceptors for MCP, ACP, and custom protocols  
- **auth-service/** - Legacy authentication service

## Quick Start
- Database
  a. docker start agentpay_postgres
- Backend
  a. cd agent_4_all-main/backend/protocol-adapters
  b. cargo build -> cargo run (cargo build only once then use cargo run)
- Frontend
  a. cd agent_4_all-main/frontend
  b. npm install
- Admin log in
  a. ./seed-admin.sh
- Finally, launch with cd agent_4_all-main/frontend -> npm start


The goal of this project was to build a working implementation for what I think Multi-Vendor Security First Agentic Commerce will look like. Let me break that down more carefully. In this context, "Multi-Vendor" represents the idea that users/owners of agents should be able to register their agent of any foundational model (LLaMa, GPT, Gemini, Claude, etc) with the goal of making transactions and interacting with Merchant stores. The reason this is a fundamental part of my project is that: 1. in my view, the number of agents that will be able to interact with merchant stores is only bound to go up due to the increase in AI/agentic development, this equation does not go down over time 2. Merchants for stores will become increasingly more open towards bot (agent) traffic as it now can represent a source of income that was undistinguishable from the standard revenue sources before. 

The second part is equally as crucial which is the "Security-First" part. This implementation focuses on making sure there is security at all levels: database, transaction, merchant, and agent registration level with more to come. As time continues to progress and more transactions are made through agents, the # of malicious transactions attempting to be made through LLM interfaces by bad actors is only bound to go up. If we know this is true, it's of utmost importance to build an implementation that is security focused. The last part which is "Agentic Commerce" is being done by the foundational model companies themselves, ex. https://developers.openai.com/commerce/, and this is acting as a intermediary platform for users to be able to compare and contrast agents. Another goal of this project was to see whether I could VISUALIZE agentic transactions better. In an attempt, I made network graphs, which allow owners to be able to create teams of agents and run evaluations to see which agents could procure the best prices. PLEASE NOTE: this is just a demo and so the prices shown in the network graph will be static and not actually retrieving the price of said item from the web. To reiterate, the goal of this is to show 1. A useful/creative implementation for what I think Agentic Commerce will look like 2. I have a strong intuition for what is to come with AI modelling/use cases. I want to emphasize that my goal is not to build this into a product as I think this idea is too natural to AI development and many people will come to these conclusions as well. I love my work currently where I resolve failing user models in PyTorch related frameworks and also build agents. I also look at my work as a very foundational part of my development of becoming an AI engineer/researcher as it teaches me many different shades of AI that I wouldn't learn elsewhere. I will continue to add cool AI use cases to this github. 


In conclusion, let me propose 2 likely scenarios that I think will happen in the future: 

Imagine you are a regular 9-5 worker in 2030 and now that agentic commerce is enabled, you start to make transactions such as buying the best set of groceries given your last x days of food. The LLM will then go execute the transaction and the merchant will then provide the goods in exchange for the money (its already being done, just not popular: https://stripe.com/newsroom/news/stripe-openai-instant-checkout). It's almost guaranteed that the agent (math/logic based actor) will be able to find a better price than a human (emotion/logic based actor) would if they were to actually interact with the store but this is something I am aiming to prove. 

As a merchant, you will be in either bucket: 
a. Early Adopter - A merchant who enabled agentic commerce pre-2030 and will be able to have a huge headstart in capturing agent-driven revenue. Early adoption means you'll be one of the first merchants that agents learn to trust and transact with, giving you a compounding advantage as more agents come online and start making purchases. 
b. Mid-Late Adopter - A merchant who waits until 2030+ to enable agentic commerce, at which point you're entering a market where early adopters have already captured the majority of agent traffic and have years of transactional data showing which merchants consistently offer the best prices and service. The agents will have already "learned" their preferred vendors, and breaking into that will be significantly harder even though the technical barrier to entry remains the same. 


The key point is that agentic commerce is inevitable, not optional. Merchants who see this as something they can delay will find themselves in the same position as stores that were slow to adopt e-commerce in the early 2000s - technically able to participate, but at a massive disadvantage to competitors who saw the shift coming earlier. Please let me know what you think!

