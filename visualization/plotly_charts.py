import boto3
from boto3.dynamodb.conditions import Key
import pandas as pd
from plotly.subplots import make_subplots
import plotly.graph_objects as go


def main():

    # pull data from dynamoDB
    TABLE_NAME = "boltstatsJS"
    dynamodb_client = boto3.client('dynamodb', region_name="us-east-1")
    ddb_data = []
    for d in ['EV BATTERY LEVEL','ODOMETER']:
        ddb_data += dynamodb_client.query(
                                TableName=TABLE_NAME,
                                KeyConditionExpression='diagnosticElement = :diagnosticElement',
                                ExpressionAttributeValues={
                                    ':diagnosticElement': {'S': d}
                                }
                                )['Items']
    df = pd.DataFrame(ddb_data)

    # clean up data
    for col in df.columns:
        df[col] = df[col].apply(lambda y: list(y.values())[0])
    df['time'] = pd.to_datetime(df['time'], unit='ms')
    df['ElementValue'] = df['ElementValue'].astype(float)
    df.loc[df['ElementUnit']=='%','ElementValue'] = df['ElementValue']/100
    df.loc[df['ElementUnit']=='KM','ElementValue'] = df['ElementValue']*0.621371
    df.loc[df['ElementUnit']=='KM','ElementUnit'] = 'Miles'
    df = df.loc[df['diagnosticGroup'] == df['diagnosticElement']]


    # export plots to a plotly html
    units = dict(df[['diagnosticElement','ElementUnit']].value_counts().index)
    fig = make_subplots(rows=len(units)+1,cols=1, subplot_titles=list(units.keys()))

    for i, e in enumerate(units.keys()):

        fig.add_trace(
            go.Scatter(x=df.loc[df['diagnosticElement'] == e,'time'], y=df.loc[df['diagnosticElement'] == e,'ElementValue'],name=e),
            row=i+1,col=1
        )
        fig.update_xaxes(title_text='Date', row=i+1, col=1)
        if units[e] == '%':
            fig.update_yaxes(title_text=units[e], row=i+1, col=1,tickformat= ',.0%')
        else:
            fig.update_yaxes(title_text=units[e], row=i+1, col=1)

    fig.update_layout(title_text="Bolt EV Diagnostic Data", height=1200)
    fig.write_html("diagnostic_charts.html")

if __name__ == '__main__':
    main()