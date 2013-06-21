nodejs-squish-report
====================

Squish reporting services uses node.js and mongodb to store and display squish reports

## Installation
### Prerequisites
* Node.js v 0.10.10+
* MongoDB v 2.4.3+

### Steps
1. Clone repository to local directory
2. Open a terminal to the root of your local copy
  * $/local/nodejs-squish-report>
3. run: __npm install__
4. Start running an instance of MongoDB on port 34001 or a port of your choosing
  * if you choose a different port, update the code in the repository
5. load some data to mongo by running __sample_job_script.js__ in the __converter__ dir
6. run: __node server.js__
7. Navigate to __localhost:34000__
  * or whatever port you have chosen

## [http://www.the-dancing-dwarf.com/pub/?p=31](Blog)