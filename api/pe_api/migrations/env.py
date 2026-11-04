from alembic import context

from pe_api.db import Base
from pe_api import models  # noqa: F401  (registers the tables)

config = context.config
target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection")
    if connectable is not None:
        context.configure(connection=connectable, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    from sqlalchemy import create_engine
    eng = create_engine(config.get_main_option("sqlalchemy.url"))
    with eng.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
