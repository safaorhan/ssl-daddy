# ssl-daddy
Solve Let's Encrypt DNS Challenge Automatically for Wildcard Certificates Using Godaddy API


MUST RUN WITH SUDO PRIVILAGES!

> sudo node app.js // Gets new challenges from lets encrypt, solves via godaddy api, gets the certificates.
> sudo service openresty reload // refresh openresty (nginx) so it reads new certificates.
