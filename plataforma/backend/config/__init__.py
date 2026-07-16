import pymysql

# PyMySQL no lugar do mysqlclient (que exige libs C/compilador do sistema) —
# faz "import MySQLdb" (usado pelo backend django.db.backends.mysql)
# resolver pra cá. Só entra em jogo quando DATABASE_URL é mysql://
# (config.settings.prod); em dev.py o banco é SQLite e isto é inofensivo.
pymysql.install_as_MySQLdb()
