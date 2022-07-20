node_modules: package-lock.json
	npm i


test: node_modules
	npm test
