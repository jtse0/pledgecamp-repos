"""
Run Mythril and Slither static analysis
"""
import subprocess
from os import path
from pathlib import Path
import click

contracts = [
    'AccountManager.sol',
    'AccountStorage.sol',
    'Administrator.sol',
    'CampShareManager.sol',
    'CampShareStorage.sol',
    'CloneFactory.sol',
    'Moderator.sol',
    'Ownable.sol',
    'PLGProjectFactory.sol',
    'PLGProject.sol'
]

def make_dir(dir):
    Path(dir).mkdir(parents=True, exist_ok=True)


# Set up file paths for analysis
def file_setup(filenames):
    if not filenames:
        filenames = contracts
    parent = path.abspath(path.join(path.dirname(__file__), '..'))
    return filenames, [f'{parent}/contracts/{f}' for f in filenames]


@click.group()
@click.pass_context
def cli(ctx):
    ctx.ensure_object(dict)


@cli.command()
@click.option('-f', '--files', type=str, multiple=True, default=None, help='Run on specific files')
def mythril(files):
    make_dir('./output/mythril')
    names, paths = file_setup(files)
    print('Mythril: analyzing', names)
    for name, path in zip(names, paths):
        print(f'Analyzing {name} at {path}')
        result = subprocess.run(
            [
                'myth',
                'analyze',
                path
            ],
            stdout=subprocess.PIPE
        )
        assert result.returncode == 0, result.stdout
        with open(f'./output/mythril/{name}.txt', 'w') as f:
            f.write(result.stdout)


@cli.command()
@click.option('-f', '--files', type=str, multiple=True, default=None, help='Run on specific files')
@click.option('-p', '--printers', type=str, default='', help='Comma separated list of printers')
def slither(files, printers):
    out = './output/slither'
    make_dir(out)
    names, paths = file_setup(files)
    print('Slither: analyzing', paths, 'with', printers)

    printArg = ['--print', printers] if printers else []

    for (name, path) in zip(names, paths):
        outFile = f'{out}/{name}.txt'
        with open(outFile, 'w') as f:
            result = subprocess.run(
                [
                    'slither',
                    path,
                    '--exclude',
                    'solc-version'

                ] + printArg,
                stderr=f,
                stdout=f
        )

if __name__ == '__main__':
    cli(obj={})
