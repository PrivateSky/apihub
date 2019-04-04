FROM ubuntu:latest

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install apt-utils git wget curl -y

RUN wget https://deb.nodesource.com/setup_11.x | bash -
RUN apt-get -y install nodejs
RUN apt-get -y install npm

RUN git clone https://github.com/PrivateSky/privatesky.git

RUN cd privatesky && \
    npm run install &&\
    npm run build

RUN cd privatesky && echo './bin/virtualMq.sh --port=8080 --folder="../tmp"' >> startup-script.sh
RUN cd privatesky && cat startup-script.sh

EXPOSE 8080/tcp

CMD cd privatesky && \
    rm -rf node_modules && \
    npm run update && \
    bash startup-script.sh
	
