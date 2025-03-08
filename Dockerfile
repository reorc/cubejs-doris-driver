FROM cubejs/cube:latest

# Install the Doris driver
RUN npm install -g @starghost/doris-driver
